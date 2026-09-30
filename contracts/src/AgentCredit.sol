// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {IERC20} from "./IERC20.sol";

/// @title AgentCredit
/// @notice Collateralized, policy bounded credit for AI agents.
///
///  * Lenders supply AUSD to a shared pool and earn the interest borrowers pay.
///  * A sponsor (person or DAO) opens a credit line for one agent: posts AUSD collateral and
///    sets hard limits (starting limit, per borrow cap, APR, due date, vendor allowlist).
///  * The agent can borrow, but the money goes straight to an allowlisted vendor. It can never
///    send borrowed funds to itself or to anyone the sponsor did not approve.
///  * The line's ceiling starts at `baseLimit` and grows with principal the agent has repaid,
///    but never above `collateral * MAX_LTV_BPS`.
///  * Interest is simple, per second. Repayment goes to interest first, then principal.
///  * If debt passes `LIQUIDATION_LTV_BPS` of collateral, or the due date passes with debt
///    outstanding, anyone can liquidate: collateral is seized to cover the debt and the
///    remainder returns to the sponsor.
///  * The sponsor can revoke instantly, which stops all new borrowing.
///
/// Known limits, stated plainly: no oracle (everything is AUSD, so collateral and debt share a
/// unit), no liquidator bonus, no protection against the pool being drained by lenders
/// withdrawing while loans are out (withdrawals are capped at idle cash), and shortfalls after
/// liquidation are socialized across lenders.
contract AgentCredit {
    uint256 public constant MAX_LTV_BPS = 7_500; // 75% of collateral is the hard ceiling
    uint256 public constant LIQUIDATION_LTV_BPS = 9_000; // debt above 90% of collateral is liquidatable
    uint256 private constant BPS = 10_000;
    uint256 private constant YEAR = 365 days;

    struct Line {
        bool active;
        uint128 collateral;
        uint128 baseLimit;
        uint128 perBorrowCap;
        uint128 principal;
        uint128 interestOwed; // interest accrued up to lastAccrual
        uint128 repaidPrincipal; // lifetime principal repaid, drives limit growth
        uint32 aprBps;
        uint64 lastAccrual;
        uint64 dueAt;
    }

    IERC20 public immutable ausd;

    // lender pool
    uint256 public totalShares;
    uint256 public totalBorrowed; // principal currently lent out
    uint256 public totalCollateral; // sponsor collateral held here; never lendable, never lender assets
    mapping(address => uint256) public sharesOf;

    // sponsor => agent => line
    mapping(address => mapping(address => Line)) public lines;
    mapping(address => mapping(address => mapping(address => bool))) public allowedVendor;
    mapping(address => mapping(address => mapping(bytes32 => bool))) public refUsed;

    event Supplied(address indexed lender, uint256 amount, uint256 shares);
    event SupplyWithdrawn(address indexed lender, uint256 amount, uint256 shares);
    event LineOpened(
        address indexed sponsor, address indexed agent, uint256 collateral, uint256 baseLimit,
        uint256 perBorrowCap, uint256 aprBps, uint64 dueAt
    );
    event VendorSet(address indexed sponsor, address indexed agent, address indexed vendor, bool allowed);
    event Borrowed(
        address indexed sponsor, address indexed agent, address indexed vendor,
        uint256 amount, bytes32 ref, uint256 debtAfter, uint256 limit
    );
    event Repaid(address indexed sponsor, address indexed agent, address indexed payer, uint256 interestPaid, uint256 principalPaid, uint256 debtAfter);
    event LineRevoked(address indexed sponsor, address indexed agent);
    event CollateralReturned(address indexed sponsor, address indexed agent, uint256 amount);
    event Liquidated(address indexed sponsor, address indexed agent, address indexed liquidator, uint256 debt, uint256 seized, uint256 returnedToSponsor, uint256 shortfall);

    error ZeroAmount();
    error LineExists();
    error LineInactive();
    error NotAgent();
    error VendorNotAllowed();
    error OverPerBorrowCap();
    error OverCreditLimit();
    error RefAlreadyUsed();
    error DebtOutstanding();
    error NotLiquidatable();
    error InsufficientCash();
    error TransferFailed();
    error BadTerms();

    constructor(IERC20 _ausd) {
        ausd = _ausd;
    }

    // ------------------------------------------------------------------ lenders

    /// @notice AUSD sitting idle in the pool (excludes sponsor collateral).
    function cash() public view returns (uint256) {
        return ausd.balanceOf(address(this)) - totalCollateral;
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
        if (!ausd.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        emit Supplied(msg.sender, amount, shares);
    }

    function withdrawSupply(uint256 shares) external returns (uint256 amount) {
        if (shares == 0) revert ZeroAmount();
        amount = (shares * totalAssets()) / totalShares;
        if (amount > cash()) revert InsufficientCash();
        sharesOf[msg.sender] -= shares;
        totalShares -= shares;
        if (!ausd.transfer(msg.sender, amount)) revert TransferFailed();
        emit SupplyWithdrawn(msg.sender, amount, shares);
    }

    // ------------------------------------------------------------------ lines

    function openLine(
        address agent,
        uint128 collateral,
        uint128 baseLimit,
        uint128 perBorrowCap,
        uint32 aprBps,
        uint64 durationSeconds
    ) external {
        if (collateral == 0) revert ZeroAmount();
        if (lines[msg.sender][agent].active) revert LineExists();
        if (perBorrowCap == 0 || perBorrowCap > baseLimit || durationSeconds == 0 || aprBps > BPS) revert BadTerms();
        if (baseLimit > (uint256(collateral) * MAX_LTV_BPS) / BPS) revert BadTerms();

        Line storage l = lines[msg.sender][agent];
        // a previous line for this pair must be fully closed (no debt), so its history resets
        if (l.principal != 0 || l.interestOwed != 0) revert DebtOutstanding();
        lines[msg.sender][agent] = Line({
            active: true,
            collateral: collateral,
            baseLimit: baseLimit,
            perBorrowCap: perBorrowCap,
            principal: 0,
            interestOwed: 0,
            repaidPrincipal: 0,
            aprBps: aprBps,
            lastAccrual: uint64(block.timestamp),
            dueAt: uint64(block.timestamp) + durationSeconds
        });
        totalCollateral += collateral;
        if (!ausd.transferFrom(msg.sender, address(this), collateral)) revert TransferFailed();
        emit LineOpened(msg.sender, agent, collateral, baseLimit, perBorrowCap, aprBps, uint64(block.timestamp) + durationSeconds);
    }

    function setVendor(address agent, address vendor, bool allowed) external {
        allowedVendor[msg.sender][agent][vendor] = allowed;
        emit VendorSet(msg.sender, agent, vendor, allowed);
    }

    function revoke(address agent) external {
        lines[msg.sender][agent].active = false;
        emit LineRevoked(msg.sender, agent);
    }

    /// @notice Total debt right now: principal plus interest accrued to this second.
    function debtOf(address sponsor, address agent) public view returns (uint256) {
        Line storage l = lines[sponsor][agent];
        return uint256(l.principal) + uint256(l.interestOwed) + _pendingInterest(l);
    }

    /// @notice Current ceiling on total debt. Grows with repaid principal, capped by collateral.
    function creditLimit(address sponsor, address agent) public view returns (uint256) {
        Line storage l = lines[sponsor][agent];
        uint256 hardCap = (uint256(l.collateral) * MAX_LTV_BPS) / BPS;
        uint256 earned = uint256(l.baseLimit) + uint256(l.repaidPrincipal);
        return earned < hardCap ? earned : hardCap;
    }

    /// @notice Called by the agent. Lends `amount` from the pool straight to an allowlisted vendor.
    function borrowAndPay(address sponsor, address vendor, uint128 amount, bytes32 ref) external {
        Line storage l = lines[sponsor][msg.sender];
        if (!l.active) revert LineInactive();
        if (amount == 0) revert ZeroAmount();
        if (!allowedVendor[sponsor][msg.sender][vendor]) revert VendorNotAllowed();
        if (amount > l.perBorrowCap) revert OverPerBorrowCap();
        if (refUsed[sponsor][msg.sender][ref]) revert RefAlreadyUsed();

        _accrue(l);
        uint256 debtAfter = uint256(l.principal) + uint256(l.interestOwed) + amount;
        uint256 limit = creditLimit(sponsor, msg.sender);
        if (debtAfter > limit) revert OverCreditLimit();
        if (amount > cash()) revert InsufficientCash();

        refUsed[sponsor][msg.sender][ref] = true;
        l.principal += amount;
        totalBorrowed += amount;
        if (!ausd.transfer(vendor, amount)) revert TransferFailed();
        emit Borrowed(sponsor, msg.sender, vendor, amount, ref, debtAfter, limit);
    }

    /// @notice Anyone may repay on an agent's behalf. Interest first, then principal.
    function repay(address sponsor, address agent, uint128 amount) external {
        Line storage l = lines[sponsor][agent];
        if (amount == 0) revert ZeroAmount();
        _accrue(l);

        uint256 interestPaid = amount < l.interestOwed ? amount : l.interestOwed;
        uint256 principalPaid = amount - interestPaid;
        if (principalPaid > l.principal) principalPaid = l.principal;
        uint256 taken = interestPaid + principalPaid;

        l.interestOwed -= uint128(interestPaid);
        l.principal -= uint128(principalPaid);
        l.repaidPrincipal += uint128(principalPaid);
        totalBorrowed -= principalPaid;
        if (!ausd.transferFrom(msg.sender, address(this), taken)) revert TransferFailed();
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
        if (back > 0 && !ausd.transfer(msg.sender, back)) revert TransferFailed();
        emit CollateralReturned(msg.sender, agent, back);
    }

    /// @notice Anyone can liquidate a line that is overdue or above the liquidation LTV.
    function liquidate(address sponsor, address agent) external {
        Line storage l = lines[sponsor][agent];
        _accrue(l);
        uint256 debt = uint256(l.principal) + uint256(l.interestOwed);
        if (debt == 0) revert NotLiquidatable();
        bool overdue = block.timestamp > l.dueAt;
        bool undercollateralized = debt * BPS > uint256(l.collateral) * LIQUIDATION_LTV_BPS;
        if (!overdue && !undercollateralized) revert NotLiquidatable();

        uint256 collateral = l.collateral;
        uint256 seized = debt < collateral ? debt : collateral;
        uint256 shortfall = debt - seized;
        uint256 back = collateral - seized;

        totalBorrowed -= l.principal;
        totalCollateral -= collateral; // seized part joins pool cash, the rest goes back below
        l.principal = 0;
        l.interestOwed = 0;
        l.collateral = 0;
        l.active = false;

        if (back > 0 && !ausd.transfer(sponsor, back)) revert TransferFailed();
        emit Liquidated(sponsor, agent, msg.sender, debt, seized, back, shortfall);
    }

    // ---------------------------------------------------------------- internals

    function _pendingInterest(Line storage l) private view returns (uint256) {
        if (l.principal == 0 || block.timestamp <= l.lastAccrual) return 0;
        return (uint256(l.principal) * l.aprBps * (block.timestamp - l.lastAccrual)) / (BPS * YEAR);
    }

    function _accrue(Line storage l) private {
        l.interestOwed += uint128(_pendingInterest(l));
        l.lastAccrual = uint64(block.timestamp);
    }
}
