// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {IERC20} from "./IERC20.sol";
import {IX402BatchSettlement as S} from "./interfaces/IX402BatchSettlement.sol";

/// @title CreditVault
/// @notice A credit layer for x402 agents. Lenders supply stablecoin to a shared vault. A sponsor
///         (person or DAO) opens a credit line for one agent. The vault is the *payer* of x402
///         batch settlement channels, so the agent only ever holds a voucher signing key and can
///         never move tokens itself.
///
///  Money out:   agent -> fundChannel -> real x402BatchSettlement escrow -> vendor (receiver)
///  Money in:    repay(), or receiveRevenue() which routes an allowlisted customer's payment so a
///               share goes to the debt first and the rest to the agent.
///  Limits:      per channel cap, credit ceiling, receiver allowlist, expiry (dueAt), instant stop
///               of new funding (revoke). Escrow already committed comes back through the x402
///               contract's withdraw delay (min 15 minutes) or a vendor refund.
///  Record:      lifetime repaid principal, revenue routed and defaults are kept per agent, not
///               per sponsor, so a proven agent's record follows it to a new sponsor. The record
///               sets a tier, and the tier sets how much credit a unit of collateral supports.
///
///  Known limits, stated plainly:
///   * The record can be farmed by an agent that borrows and repays its own small lines. That
///     costs it interest, and revenue only counts from payers the sponsor allowlisted, but it is
///     not sybil proof. Tier thresholds are demo parameters, not calibrated risk numbers.
///   * Tiers above 100% LTV are undercollateralized: a default there is a loss to lenders.
///   * An agent and an allowlisted receiver that collude can claim a channel's full escrow, so
///     the channel deposit (bounded by perBorrowCap and the ceiling) is the maximum loss.
///   * No oracle: collateral, debt and payments are all the same stablecoin.
///   * Refunds arrive at this contract with no callback. Only tokens the vault has accounted for
///     count toward lender share price, and `reconcile` books a refund and lowers the debt in one
///     step, so a refund can never be double counted. Until someone calls it, that refund sits idle.
contract CreditVault {
    // ------------------------------------------------------------------ config
    uint256 private constant BPS = 10_000;
    uint256 private constant YEAR = 365 days;
    uint40 public constant MIN_WITHDRAW_DELAY = 15 minutes;
    uint256 public constant LIQUIDATION_BUFFER_BPS = 1_500;
    uint256 public constant MIN_REPAY_SHARE_BPS = 1_000; // a line must route at least 10% of revenue to debt

    // tier thresholds by lifetime repaid principal (6 decimal units)
    uint256 public constant TIER1 = 100e6;
    uint256 public constant TIER2 = 500e6;
    uint256 public constant TIER3 = 2_000e6;

    S public immutable settlement;
    IERC20 public immutable token;

    // ------------------------------------------------------------------- state
    struct Line {
        bool active;
        uint128 collateral;
        uint128 baseLimit;
        uint128 perBorrowCap;
        uint128 principal; // includes escrow committed to channels and not yet returned
        uint128 interestOwed;
        uint32 aprBps;
        uint32 repayShareBps;
        uint64 lastAccrual;
        uint64 dueAt;
    }

    struct Record {
        uint128 repaidPrincipal;
        uint128 revenueRouted;
        uint32 defaults;
        uint32 lines;
    }

    // lender pool
    uint256 public totalShares;
    uint256 public totalBorrowed;
    uint256 public totalCollateral;
    /// @dev Tokens the vault has itself booked. cash() uses this, not balanceOf, so an unreconciled
    ///      refund cannot inflate the share price.
    uint256 public accounted;
    mapping(address => uint256) public sharesOf;

    mapping(address sponsor => mapping(address agent => Line)) public lines;
    mapping(address agent => Record) private _record;
    mapping(address sponsor => mapping(address agent => mapping(address receiver => address))) public receiverAuthorizerOf;
    mapping(address sponsor => mapping(address agent => mapping(address payer => bool))) public allowedPayer;

    struct ChannelInfo {
        address sponsor;
        address agent;
        uint128 funded;
        uint128 returned;
    }
    mapping(bytes32 channelId => ChannelInfo) public channelInfo;

    bytes32 private _pending; // keccak(channelId, amount) authorised for one collect() call

    // ------------------------------------------------------------------ events
    event Supplied(address indexed lender, uint256 amount, uint256 shares);
    event SupplyWithdrawn(address indexed lender, uint256 amount, uint256 shares);
    event LineOpened(address indexed sponsor, address indexed agent, uint256 collateral, uint256 baseLimit, uint256 perBorrowCap, uint256 aprBps, uint256 repayShareBps, uint64 dueAt);
    event VendorSet(address indexed sponsor, address indexed agent, address indexed receiver, address receiverAuthorizer);
    event RevenuePayerSet(address indexed sponsor, address indexed agent, address indexed payer, bool allowed);
    event ChannelFunded(address indexed sponsor, address indexed agent, address indexed receiver, bytes32 channelId, uint256 amount, uint256 debtAfter, uint256 limit);
    event ChannelReconciled(bytes32 indexed channelId, uint256 returnedNow, uint256 debtAfter);
    event ReclaimStarted(bytes32 indexed channelId, uint256 amount);
    event Repaid(address indexed sponsor, address indexed agent, address indexed payer, uint256 interestPaid, uint256 principalPaid, uint256 debtAfter);
    event RevenueRouted(address indexed sponsor, address indexed agent, address indexed payer, uint256 amount, uint256 toDebt, uint256 toAgent);
    event LineRevoked(address indexed sponsor, address indexed agent);
    event CollateralReturned(address indexed sponsor, address indexed agent, uint256 amount);
    event Liquidated(address indexed sponsor, address indexed agent, address indexed liquidator, uint256 debt, uint256 seized, uint256 returnedToSponsor, uint256 shortfall);

    // ------------------------------------------------------------------ errors
    error ZeroAmount();
    error LineExists();
    error LineInactive();
    error LineExpired();
    error NotAgent();
    error ReceiverNotAllowed();
    error PayerNotAllowed();
    error OverPerBorrowCap();
    error OverCreditLimit();
    error DebtOutstanding();
    error NotLiquidatable();
    error InsufficientCash();
    error StillActive();
    error UnknownChannel();
    error NotSettlement();
    error UnauthorizedCollect();
    error TransferFailed();
    error BadTerms();

    constructor(S _settlement, IERC20 _token) {
        settlement = _settlement;
        token = _token;
    }

    // ================================================================= lenders

    function cash() public view returns (uint256) {
        return accounted - totalCollateral;
    }

    function totalAssets() public view returns (uint256) {
        return cash() + totalBorrowed;
    }

    function supply(uint256 amount) external returns (uint256 shares) {
        if (amount == 0) revert ZeroAmount();
        uint256 assets = totalAssets();
        shares = totalShares == 0 || assets == 0 ? amount : (amount * totalShares) / assets;
        totalShares += shares;
        sharesOf[msg.sender] += shares;
        _in(msg.sender, amount);
        emit Supplied(msg.sender, amount, shares);
    }

    function withdrawSupply(uint256 shares) external returns (uint256 amount) {
        if (shares == 0) revert ZeroAmount();
        amount = (shares * totalAssets()) / totalShares;
        if (amount > cash()) revert InsufficientCash();
        sharesOf[msg.sender] -= shares;
        totalShares -= shares;
        _out(msg.sender, amount);
        emit SupplyWithdrawn(msg.sender, amount, shares);
    }

    // =================================================================== record

    function recordOf(address agent)
        external
        view
        returns (uint256 repaidPrincipal, uint256 revenueRouted, uint256 defaults, uint256 tier, uint256 ltvBps)
    {
        Record storage r = _record[agent];
        return (r.repaidPrincipal, r.revenueRouted, r.defaults, tierOf(agent), ltvBpsOf(agent));
    }

    /// @notice 0..3, from lifetime repaid principal. Any default pins the agent to tier 0.
    function tierOf(address agent) public view returns (uint256) {
        Record storage r = _record[agent];
        if (r.defaults > 0) return 0;
        if (r.repaidPrincipal >= TIER3) return 3;
        if (r.repaidPrincipal >= TIER2) return 2;
        if (r.repaidPrincipal >= TIER1) return 1;
        return 0;
    }

    /// @notice Credit supported per unit of collateral: 75% / 100% / 150% / 250%.
    function ltvBpsOf(address agent) public view returns (uint256) {
        uint256 t = tierOf(agent);
        if (t == 0) return 7_500;
        if (t == 1) return 10_000;
        if (t == 2) return 15_000;
        return 25_000;
    }

    // ==================================================================== lines

    function openLine(
        address agent,
        uint128 collateral,
        uint128 baseLimit,
        uint128 perBorrowCap,
        uint32 aprBps,
        uint64 durationSeconds,
        uint32 repayShareBps
    ) external {
        Line storage l = lines[msg.sender][agent];
        if (l.active) revert LineExists();
        if (l.principal != 0 || l.interestOwed != 0) revert DebtOutstanding();
        if (collateral == 0) revert ZeroAmount();
        if (perBorrowCap == 0 || perBorrowCap > baseLimit || durationSeconds == 0 || aprBps > BPS) revert BadTerms();
        if (repayShareBps < MIN_REPAY_SHARE_BPS || repayShareBps > BPS) revert BadTerms();
        if (uint256(baseLimit) > (uint256(collateral) * ltvBpsOf(agent)) / BPS) revert BadTerms();

        l.active = true;
        l.collateral = collateral;
        l.baseLimit = baseLimit;
        l.perBorrowCap = perBorrowCap;
        l.aprBps = aprBps;
        l.repayShareBps = repayShareBps;
        l.lastAccrual = uint64(block.timestamp);
        l.dueAt = uint64(block.timestamp) + durationSeconds;
        _record[agent].lines += 1;

        totalCollateral += collateral;
        _in(msg.sender, collateral);
        emit LineOpened(msg.sender, agent, collateral, baseLimit, perBorrowCap, aprBps, repayShareBps, l.dueAt);
    }

    /// @notice Sponsor allowlists a vendor and names the key that authorizes claims and refunds for it.
    function setVendor(address agent, address receiver, address receiverAuthorizer) external {
        receiverAuthorizerOf[msg.sender][agent][receiver] = receiverAuthorizer;
        emit VendorSet(msg.sender, agent, receiver, receiverAuthorizer);
    }

    /// @notice Sponsor allowlists a customer wallet whose payments to the agent may count as revenue.
    function setRevenuePayer(address agent, address payer, bool allowed) external {
        allowedPayer[msg.sender][agent][payer] = allowed;
        emit RevenuePayerSet(msg.sender, agent, payer, allowed);
    }

    /// @notice Stops all new funding immediately. Committed escrow returns via reclaim or a refund.
    function revoke(address agent) external {
        lines[msg.sender][agent].active = false;
        emit LineRevoked(msg.sender, agent);
    }

    function debtOf(address sponsor, address agent) public view returns (uint256) {
        Line storage l = lines[sponsor][agent];
        return uint256(l.principal) + uint256(l.interestOwed) + _pendingInterest(l);
    }

    /// @notice Ceiling on total debt: base limit plus the agent's lifetime repaid principal, never
    ///         above what the collateral supports at the agent's current tier.
    function creditLimit(address sponsor, address agent) public view returns (uint256) {
        Line storage l = lines[sponsor][agent];
        uint256 hardCap = (uint256(l.collateral) * ltvBpsOf(agent)) / BPS;
        uint256 earned = uint256(l.baseLimit) + uint256(_record[agent].repaidPrincipal);
        return earned < hardCap ? earned : hardCap;
    }

    // ================================================================== funding

    /// @notice The agent asks the vault to escrow `amount` into an x402 batch settlement channel for a
    ///         vendor. Every check runs before any token moves; the settlement contract then calls
    ///         back into `collect`. The agent is the channel's payerAuthorizer, so it signs vouchers.
    function fundChannel(address sponsor, address receiver, uint40 withdrawDelay, bytes32 salt, uint128 amount)
        external
        returns (bytes32 channelId)
    {
        Line storage l = lines[sponsor][msg.sender];
        if (!l.active) revert LineInactive();
        if (block.timestamp >= l.dueAt) revert LineExpired();
        if (amount == 0) revert ZeroAmount();
        address receiverAuth = receiverAuthorizerOf[sponsor][msg.sender][receiver];
        if (receiverAuth == address(0)) revert ReceiverNotAllowed();
        if (amount > l.perBorrowCap) revert OverPerBorrowCap();

        _accrue(l);
        uint256 debtAfter = uint256(l.principal) + uint256(l.interestOwed) + amount;
        uint256 limit = creditLimit(sponsor, msg.sender);
        if (debtAfter > limit) revert OverCreditLimit();
        if (amount > cash()) revert InsufficientCash();

        S.ChannelConfig memory config = S.ChannelConfig({
            payer: address(this),
            payerAuthorizer: msg.sender,
            receiver: receiver,
            receiverAuthorizer: receiverAuth,
            token: address(token),
            withdrawDelay: withdrawDelay < MIN_WITHDRAW_DELAY ? MIN_WITHDRAW_DELAY : withdrawDelay,
            salt: salt
        });
        channelId = settlement.getChannelId(config);

        ChannelInfo storage ci = channelInfo[channelId];
        if (ci.funded == 0) {
            ci.sponsor = sponsor;
            ci.agent = msg.sender;
        } else if (ci.sponsor != sponsor || ci.agent != msg.sender) {
            revert UnauthorizedCollect();
        }
        ci.funded += amount;
        l.principal += amount;
        totalBorrowed += amount;

        _pending = keccak256(abi.encode(channelId, uint256(amount)));
        settlement.deposit(config, amount, address(this), "");
        _pending = bytes32(0);
        emit ChannelFunded(sponsor, msg.sender, receiver, channelId, amount, debtAfter, limit);
    }

    /// @notice Called by the settlement contract during `deposit`. Releases tokens only for a deposit
    ///         this contract just authorised in `fundChannel`.
    function collect(address payer, address _token, uint256 amount, bytes32 channelId, bytes calldata) external {
        if (msg.sender != address(settlement)) revert NotSettlement();
        if (payer != address(this) || _token != address(token)) revert UnauthorizedCollect();
        if (_pending == bytes32(0) || _pending != keccak256(abi.encode(channelId, amount))) revert UnauthorizedCollect();
        _pending = bytes32(0);
        accounted -= amount;
        if (!token.transfer(address(settlement), amount)) revert TransferFailed();
    }

    /// @notice Books escrow that came back to the vault (a vendor refund or a finished withdrawal)
    ///         and lowers the agent's debt by the same amount. Anyone can call it.
    function reconcile(S.ChannelConfig calldata config) external {
        bytes32 channelId = settlement.getChannelId(config);
        ChannelInfo storage ci = channelInfo[channelId];
        if (ci.funded == 0) revert UnknownChannel();

        (uint128 balance,) = settlement.channels(channelId);
        uint128 returnedNow = ci.funded - balance; // funded = returned + still in escrow
        uint128 delta = returnedNow - ci.returned;
        if (delta == 0) return;
        ci.returned = returnedNow;

        accounted += delta;
        Line storage l = lines[ci.sponsor][ci.agent];
        uint128 cut = delta > l.principal ? l.principal : delta; // a liquidated line already wrote this off
        l.principal -= cut;
        totalBorrowed -= cut;
        emit ChannelReconciled(channelId, delta, uint256(l.principal) + uint256(l.interestOwed));
    }

    /// @notice Once a line is revoked or past due, anyone can start pulling a channel's unclaimed
    ///         escrow back. It arrives after the channel's withdraw delay; then call reconcile.
    function reclaim(S.ChannelConfig calldata config, uint128 amount) external {
        bytes32 channelId = settlement.getChannelId(config);
        ChannelInfo storage ci = channelInfo[channelId];
        if (ci.funded == 0) revert UnknownChannel();
        Line storage l = lines[ci.sponsor][ci.agent];
        if (l.active && block.timestamp < l.dueAt) revert StillActive();
        settlement.initiateWithdraw(config, amount);
        emit ReclaimStarted(channelId, amount);
    }

    function finalizeReclaim(S.ChannelConfig calldata config) external {
        settlement.finalizeWithdraw(config);
    }

    // ================================================================= repayment

    /// @notice Anyone may repay on an agent's behalf. Interest first, then principal.
    function repay(address sponsor, address agent, uint128 amount) external {
        if (amount == 0) revert ZeroAmount();
        Line storage l = lines[sponsor][agent];
        _accrue(l);
        (uint256 interestPaid, uint256 principalPaid) = _split(l, amount);
        _in(msg.sender, interestPaid + principalPaid);
        _applyRepayment(l, agent, interestPaid, principalPaid);
        emit Repaid(sponsor, agent, msg.sender, interestPaid, principalPaid, uint256(l.principal) + uint256(l.interestOwed));
    }

    /// @notice An allowlisted customer pays the agent through the vault. The line's repay share (or
    ///         all the debt, if less) goes to the loan first; the rest goes straight to the agent.
    function receiveRevenue(address sponsor, address agent, uint128 amount) external {
        if (amount == 0) revert ZeroAmount();
        if (!allowedPayer[sponsor][agent][msg.sender]) revert PayerNotAllowed();
        Line storage l = lines[sponsor][agent];
        _accrue(l);

        _in(msg.sender, amount);
        uint256 share = (uint256(amount) * l.repayShareBps) / BPS;
        (uint256 interestPaid, uint256 principalPaid) = _split(l, share);
        uint256 toDebt = interestPaid + principalPaid;
        _applyRepayment(l, agent, interestPaid, principalPaid);
        _record[agent].revenueRouted += amount;

        uint256 toAgent = amount - toDebt;
        if (toAgent > 0) _out(agent, toAgent);
        emit RevenueRouted(sponsor, agent, msg.sender, amount, toDebt, toAgent);
        emit Repaid(sponsor, agent, msg.sender, interestPaid, principalPaid, uint256(l.principal) + uint256(l.interestOwed));
    }

    /// @notice Sponsor takes collateral back once the line is debt free.
    function closeLine(address agent) external {
        Line storage l = lines[msg.sender][agent];
        _accrue(l);
        if (l.principal != 0 || l.interestOwed != 0) revert DebtOutstanding();
        uint256 back = l.collateral;
        l.collateral = 0;
        l.active = false;
        totalCollateral -= back;
        if (back > 0) _out(msg.sender, back);
        emit CollateralReturned(msg.sender, agent, back);
    }

    // ================================================================ liquidation

    /// @notice Anyone can liquidate a line that is overdue or above its liquidation LTV.
    ///         A liquidation is a default: it pins the agent to tier 0 from then on.
    function liquidate(address sponsor, address agent) external {
        Line storage l = lines[sponsor][agent];
        _accrue(l);
        uint256 debt = uint256(l.principal) + uint256(l.interestOwed);
        if (debt == 0) revert NotLiquidatable();
        bool overdue = block.timestamp > l.dueAt;
        uint256 liqBps = ltvBpsOf(agent) + LIQUIDATION_BUFFER_BPS;
        bool underwater = debt * BPS > uint256(l.collateral) * liqBps;
        if (!overdue && !underwater) revert NotLiquidatable();

        uint256 collateral = l.collateral;
        uint256 seized = debt < collateral ? debt : collateral;
        uint256 shortfall = debt - seized;
        uint256 back = collateral - seized;

        totalBorrowed -= l.principal;
        totalCollateral -= collateral; // seized part stays in accounted and becomes pool cash
        l.principal = 0;
        l.interestOwed = 0;
        l.collateral = 0;
        l.active = false;
        _record[agent].defaults += 1;

        if (back > 0) _out(sponsor, back);
        emit Liquidated(sponsor, agent, msg.sender, debt, seized, back, shortfall);
    }

    // ================================================================== internals

    function _in(address from, uint256 amount) private {
        accounted += amount;
        if (!token.transferFrom(from, address(this), amount)) revert TransferFailed();
    }

    function _out(address to, uint256 amount) private {
        accounted -= amount;
        if (!token.transfer(to, amount)) revert TransferFailed();
    }

    function _pendingInterest(Line storage l) private view returns (uint256) {
        if (l.principal == 0 || block.timestamp <= l.lastAccrual) return 0;
        return (uint256(l.principal) * l.aprBps * (block.timestamp - l.lastAccrual)) / (BPS * YEAR);
    }

    function _accrue(Line storage l) private {
        l.interestOwed += uint128(_pendingInterest(l));
        l.lastAccrual = uint64(block.timestamp);
    }

    /// @dev How much of `amount` goes to interest and how much to principal, capped at what is owed.
    function _split(Line storage l, uint256 amount) private view returns (uint256 interestPaid, uint256 principalPaid) {
        interestPaid = amount < l.interestOwed ? amount : l.interestOwed;
        principalPaid = amount - interestPaid;
        if (principalPaid > l.principal) principalPaid = l.principal;
    }

    function _applyRepayment(Line storage l, address agent, uint256 interestPaid, uint256 principalPaid) private {
        l.interestOwed -= uint128(interestPaid);
        l.principal -= uint128(principalPaid);
        totalBorrowed -= principalPaid;
        _record[agent].repaidPrincipal += uint128(principalPaid);
    }
}
