// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {IERC20} from "./IERC20.sol";

/// @title AgentSpend
/// @notice Lets a human owner give an AI agent a bounded AUSD budget. The agent can pay
///         per API call or per inference step, but never above the per-call cap, the
///         daily cap, or to a recipient outside the owner's allowlist. The owner can
///         revoke instantly. The owner approves this contract for AUSD once; the agent
///         never holds a key with unlimited spend authority.
contract AgentSpend {
    struct Policy {
        uint128 perCallCap;
        uint128 dailyCap;
        bool active;
    }

    IERC20 public immutable ausd;

    // owner => agent => policy
    mapping(address => mapping(address => Policy)) public policies;
    // owner => agent => recipient => allowed
    mapping(address => mapping(address => mapping(address => bool))) public allowedRecipient;
    // owner => agent => day index => spent
    mapping(address => mapping(address => mapping(uint256 => uint256))) public spentOnDay;
    // owner => agent => ref => already paid (blocks replaying the same call reference)
    mapping(address => mapping(address => mapping(bytes32 => bool))) public refUsed;

    event PolicySet(address indexed owner, address indexed agent, uint256 perCallCap, uint256 dailyCap);
    event PolicyRevoked(address indexed owner, address indexed agent);
    event RecipientSet(address indexed owner, address indexed agent, address indexed recipient, bool allowed);
    event AgentPaid(
        address indexed owner, address indexed agent, address indexed recipient,
        uint256 amount, bytes32 ref, uint256 spentToday
    );

    error PolicyInactive();
    error RecipientNotAllowed();
    error OverPerCallCap();
    error OverDailyCap();
    error RefAlreadyUsed();
    error ZeroAmount();
    error TransferFailed();

    constructor(IERC20 _ausd) {
        ausd = _ausd;
    }

    function setPolicy(address agent, uint128 perCallCap, uint128 dailyCap) external {
        require(perCallCap > 0 && dailyCap >= perCallCap, "bad caps");
        policies[msg.sender][agent] = Policy(perCallCap, dailyCap, true);
        emit PolicySet(msg.sender, agent, perCallCap, dailyCap);
    }

    function setRecipient(address agent, address recipient, bool allowed) external {
        allowedRecipient[msg.sender][agent][recipient] = allowed;
        emit RecipientSet(msg.sender, agent, recipient, allowed);
    }

    function revoke(address agent) external {
        policies[msg.sender][agent].active = false;
        emit PolicyRevoked(msg.sender, agent);
    }

    /// @notice Called by the agent. Pulls `amount` AUSD from `owner` to `recipient`.
    function pay(address owner, address recipient, uint128 amount, bytes32 ref) external {
        Policy memory p = policies[owner][msg.sender];
        if (!p.active) revert PolicyInactive();
        if (amount == 0) revert ZeroAmount();
        if (!allowedRecipient[owner][msg.sender][recipient]) revert RecipientNotAllowed();
        if (amount > p.perCallCap) revert OverPerCallCap();
        if (refUsed[owner][msg.sender][ref]) revert RefAlreadyUsed();

        uint256 day = block.timestamp / 1 days;
        uint256 spent = spentOnDay[owner][msg.sender][day] + amount;
        if (spent > p.dailyCap) revert OverDailyCap();

        refUsed[owner][msg.sender][ref] = true;
        spentOnDay[owner][msg.sender][day] = spent;
        if (!ausd.transferFrom(owner, recipient, amount)) revert TransferFailed();
        emit AgentPaid(owner, msg.sender, recipient, amount, ref, spent);
    }
}
