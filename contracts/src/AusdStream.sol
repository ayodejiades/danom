// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {IERC20} from "./IERC20.sol";

/// @title AusdStream
/// @notice Linear per-second AUSD payment streams. A sender locks the full amount up front;
///         the recipient can pull whatever has accrued at any moment; the sender can cancel
///         and get the unaccrued remainder back. Every state change emits a receipt event
///         that an indexer (Envio HyperIndex / HyperSync) can consume.
contract AusdStream {
    struct Stream {
        address sender;
        address recipient;
        uint128 deposit;
        uint128 withdrawn;
        uint64 start;
        uint64 end;
        bytes32 corridor; // e.g. keccak256("US>NG"), display metadata only
        bool cancelled;
        uint128 accruedAtCancel;
    }

    IERC20 public immutable ausd;
    uint256 public nextStreamId;
    mapping(uint256 => Stream) public streams;

    event StreamOpened(
        uint256 indexed id, address indexed sender, address indexed recipient,
        uint256 deposit, uint64 start, uint64 end, bytes32 corridor, bytes32 memo
    );
    event Withdrawn(uint256 indexed id, address indexed recipient, uint256 amount);
    event StreamCancelled(uint256 indexed id, uint256 paidToRecipient, uint256 refundedToSender);

    error ZeroAmount();
    error BadDuration();
    error BadRecipient();
    error NotSender();
    error NotRecipient();
    error AlreadyCancelled();
    error NothingToWithdraw();
    error TransferFailed();

    constructor(IERC20 _ausd) {
        ausd = _ausd;
    }

    function openStream(address recipient, uint128 amount, uint64 duration, bytes32 corridor, bytes32 memo)
        external
        returns (uint256 id)
    {
        if (amount == 0) revert ZeroAmount();
        if (duration == 0) revert BadDuration();
        if (recipient == address(0) || recipient == msg.sender) revert BadRecipient();

        id = nextStreamId++;
        uint64 start = uint64(block.timestamp);
        streams[id] = Stream({
            sender: msg.sender,
            recipient: recipient,
            deposit: amount,
            withdrawn: 0,
            start: start,
            end: start + duration,
            corridor: corridor,
            cancelled: false,
            accruedAtCancel: 0
        });
        if (!ausd.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        emit StreamOpened(id, msg.sender, recipient, amount, start, start + duration, corridor, memo);
    }

    /// @notice Amount accrued to the recipient so far, including anything already withdrawn.
    function accrued(uint256 id) public view returns (uint256) {
        Stream storage s = streams[id];
        if (s.cancelled) return s.accruedAtCancel;
        if (block.timestamp >= s.end) return s.deposit;
        if (block.timestamp <= s.start) return 0;
        return (uint256(s.deposit) * (block.timestamp - s.start)) / (s.end - s.start);
    }

    function withdrawable(uint256 id) public view returns (uint256) {
        return accrued(id) - streams[id].withdrawn;
    }

    function withdraw(uint256 id) external returns (uint256 amount) {
        Stream storage s = streams[id];
        if (msg.sender != s.recipient) revert NotRecipient();
        amount = withdrawable(id);
        if (amount == 0) revert NothingToWithdraw();
        s.withdrawn += uint128(amount);
        if (!ausd.transfer(s.recipient, amount)) revert TransferFailed();
        emit Withdrawn(id, s.recipient, amount);
    }

    /// @notice Sender stops the stream. Recipient is paid everything accrued to this second,
    ///         sender gets the rest. Nothing can be taken back from what already accrued.
    function cancel(uint256 id) external {
        Stream storage s = streams[id];
        if (msg.sender != s.sender) revert NotSender();
        if (s.cancelled) revert AlreadyCancelled();

        uint256 earned = accrued(id);
        uint256 payRecipient = earned - s.withdrawn;
        uint256 refund = s.deposit - earned;

        s.cancelled = true;
        s.accruedAtCancel = uint128(earned);
        s.withdrawn = uint128(earned);

        if (payRecipient > 0 && !ausd.transfer(s.recipient, payRecipient)) revert TransferFailed();
        if (refund > 0 && !ausd.transfer(s.sender, refund)) revert TransferFailed();
        emit StreamCancelled(id, payRecipient, refund);
    }
}
