// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {IERC20} from "./IERC20.sol";
import {IX402BatchSettlement as S} from "./interfaces/IX402BatchSettlement.sol";

/// @title ChannelFunder
/// @notice Prototype of the credit vault's spending path. The vault is the *payer* of x402
///         batch-settlement channels. It also acts as the deposit collector, so it can check
///         the credit policy in the same transaction that moves money into escrow.
///
///  * The agent holds only a voucher signing key. Every channel the vault opens names the agent
///    as `payerAuthorizer`, so the agent can sign vouchers but cannot move tokens itself.
///  * Money leaves the vault only through `fundChannel`, only to allowlisted receivers, only up
///    to the per fund cap, the total credit line and the policy expiry.
///  * `revoke` (owner) blocks all new funding immediately. Escrow already committed to a channel
///    comes back through `reclaim`/`finalizeReclaim` after the channel's withdraw delay (the
///    delay is chosen by the vault, minimum 15 minutes per the x402 contract), or sooner if the
///    receiver cooperates with a refund.
///
/// Honest limit: an agent and an allowlisted receiver that collude can sign and claim vouchers up
/// to the full escrow of a channel. The bound on that loss is the channel deposit, which is why
/// the per fund cap and credit line exist.
contract ChannelFunder {
    S public immutable settlement;
    IERC20 public immutable token;
    address public immutable owner;

    address public agent;
    uint128 public perFundCap;
    uint128 public creditLine;
    uint128 public totalFunded;
    uint64 public expiry;
    bool public active;
    uint40 public constant WITHDRAW_DELAY = 15 minutes;

    mapping(address receiver => address receiverAuthorizer) public receiverAuthorizerOf; // zero = not allowed

    bytes32 private _pending; // keccak(channelId, amount) authorised for exactly one collect() call

    event PolicySet(address indexed agent, uint256 perFundCap, uint256 creditLine, uint64 expiry);
    event ReceiverSet(address indexed receiver, address receiverAuthorizer);
    event Revoked();
    event ChannelFunded(bytes32 indexed channelId, address indexed receiver, uint256 amount, uint256 totalFunded);
    event ReclaimStarted(bytes32 indexed channelId, uint256 amount);
    event ReclaimFinished(bytes32 indexed channelId);

    error NotOwner();
    error NotAgent();
    error PolicyInactive();
    error PolicyExpired();
    error ReceiverNotAllowed();
    error OverPerFundCap();
    error OverCreditLine();
    error NotSettlement();
    error UnauthorizedCollect();
    error StillActive();
    error TransferFailed();

    constructor(S _settlement, IERC20 _token) {
        settlement = _settlement;
        token = _token;
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // ---------------------------------------------------------------- policy

    function setPolicy(address _agent, uint128 _perFundCap, uint128 _creditLine, uint64 _expiry) external onlyOwner {
        require(_perFundCap > 0 && _creditLine >= _perFundCap && _expiry > block.timestamp, "bad policy");
        agent = _agent;
        perFundCap = _perFundCap;
        creditLine = _creditLine;
        expiry = _expiry;
        active = true;
        emit PolicySet(_agent, _perFundCap, _creditLine, _expiry);
    }

    function setReceiver(address receiver, address receiverAuthorizer) external onlyOwner {
        receiverAuthorizerOf[receiver] = receiverAuthorizer;
        emit ReceiverSet(receiver, receiverAuthorizer);
    }

    function revoke() external onlyOwner {
        active = false;
        emit Revoked();
    }

    /// @notice Prototype only: the owner funds and defunds the vault directly.
    function withdrawIdle(uint256 amount) external onlyOwner {
        if (!token.transfer(owner, amount)) revert TransferFailed();
    }

    // --------------------------------------------------------------- funding

    /// @notice The agent asks the vault to escrow `amount` for `receiver`. Every check runs before
    ///         any token moves; the settlement contract then calls back into `collect`.
    function fundChannel(address receiver, uint40 withdrawDelay, bytes32 salt, uint128 amount)
        external
        returns (bytes32 channelId)
    {
        if (msg.sender != agent) revert NotAgent();
        if (!active) revert PolicyInactive();
        if (block.timestamp >= expiry) revert PolicyExpired();
        address receiverAuth = receiverAuthorizerOf[receiver];
        if (receiverAuth == address(0)) revert ReceiverNotAllowed();
        if (amount > perFundCap) revert OverPerFundCap();
        if (uint256(totalFunded) + amount > creditLine) revert OverCreditLine();

        S.ChannelConfig memory config = S.ChannelConfig({
            payer: address(this),
            payerAuthorizer: agent,
            receiver: receiver,
            receiverAuthorizer: receiverAuth,
            token: address(token),
            withdrawDelay: withdrawDelay < WITHDRAW_DELAY ? WITHDRAW_DELAY : withdrawDelay,
            salt: salt
        });
        channelId = settlement.getChannelId(config);

        totalFunded += amount;
        _pending = keccak256(abi.encode(channelId, amount));
        settlement.deposit(config, amount, address(this), "");
        _pending = bytes32(0);
        emit ChannelFunded(channelId, receiver, amount, totalFunded);
    }

    /// @notice Called by the settlement contract during `deposit`. Refuses anything the vault did
    ///         not just authorise in `fundChannel`.
    function collect(address payer, address _token, uint256 amount, bytes32 channelId, bytes calldata) external {
        if (msg.sender != address(settlement)) revert NotSettlement();
        if (payer != address(this) || _token != address(token)) revert UnauthorizedCollect();
        if (_pending == bytes32(0) || _pending != keccak256(abi.encode(channelId, amount))) revert UnauthorizedCollect();
        _pending = bytes32(0);
        if (!token.transfer(address(settlement), amount)) revert TransferFailed();
    }

    // --------------------------------------------------------------- reclaim

    /// @notice Anyone can start pulling unclaimed escrow back once the policy is revoked or expired.
    function reclaim(S.ChannelConfig calldata config, uint128 amount) external {
        if (active && block.timestamp < expiry) revert StillActive();
        settlement.initiateWithdraw(config, amount);
        emit ReclaimStarted(settlement.getChannelId(config), amount);
    }

    /// @notice After the channel's withdraw delay, returns the escrow to this vault.
    function finalizeReclaim(S.ChannelConfig calldata config) external {
        settlement.finalizeWithdraw(config);
        emit ReclaimFinished(settlement.getChannelId(config));
    }
}
