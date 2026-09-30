// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {IERC20} from "../../src/IERC20.sol";
import {IX402BatchSettlement as S} from "../../src/interfaces/IX402BatchSettlement.sol";

interface ICollector {
    function collect(address payer, address token, uint256 amount, bytes32 channelId, bytes calldata data) external;
}

/// @notice Offline stand in for the canonical x402BatchSettlement, matching its ABI and the behaviours
///         the vault relies on. The same tests also run against the real contract on a Monad fork.
contract MockX402Settlement {
    struct ChannelState { uint128 balance; uint128 totalClaimed; }
    struct Withdrawal { uint128 amount; uint40 initiatedAt; }
    struct ReceiverState { uint128 totalClaimed; uint128 totalSettled; }

    mapping(bytes32 => ChannelState) public channels;
    mapping(bytes32 => Withdrawal) public pending;
    mapping(address => mapping(address => ReceiverState)) public receivers;

    function getChannelId(S.ChannelConfig calldata c) public view returns (bytes32) {
        return keccak256(abi.encode(c, address(this), block.chainid));
    }

    function getVoucherDigest(bytes32 channelId, uint128 max) public view returns (bytes32) {
        return keccak256(abi.encode("voucher", address(this), block.chainid, channelId, max));
    }

    function deposit(S.ChannelConfig calldata c, uint128 amount, address collector, bytes calldata data) external {
        require(c.payer != address(0) && c.receiver != address(0) && c.receiverAuthorizer != address(0), "channel");
        require(c.withdrawDelay >= 15 minutes && c.withdrawDelay <= 30 days, "delay");
        require(amount > 0, "zero");
        bytes32 id = getChannelId(c);
        channels[id].balance += amount;
        uint256 before_ = IERC20(c.token).balanceOf(address(this));
        ICollector(collector).collect(c.payer, c.token, amount, id, data);
        require(IERC20(c.token).balanceOf(address(this)) == before_ + amount, "collection");
    }

    function claim(S.VoucherClaim[] calldata claims) external {
        for (uint256 i = 0; i < claims.length; ++i) {
            S.ChannelConfig calldata c = claims[i].voucher.channel;
            require(msg.sender == c.receiver || msg.sender == c.receiverAuthorizer, "not receiver side");
            bytes32 id = getChannelId(c);
            ChannelState storage ch = channels[id];
            if (claims[i].totalClaimed <= ch.totalClaimed) continue;
            require(claims[i].totalClaimed <= claims[i].voucher.maxClaimableAmount, "ceiling");
            require(claims[i].totalClaimed <= ch.balance, "balance");
            bytes calldata sig = claims[i].signature;
            address rec = ecrecover(getVoucherDigest(id, claims[i].voucher.maxClaimableAmount), uint8(sig[64]), bytes32(sig[0:32]), bytes32(sig[32:64]));
            require(rec == c.payerAuthorizer && rec != address(0), "signature");
            receivers[c.receiver][c.token].totalClaimed += claims[i].totalClaimed - ch.totalClaimed;
            ch.totalClaimed = claims[i].totalClaimed;
        }
    }

    function settle(address receiver, address token) external {
        ReceiverState storage rs = receivers[receiver][token];
        uint128 amount = rs.totalClaimed - rs.totalSettled;
        if (amount == 0) return;
        rs.totalSettled = rs.totalClaimed;
        IERC20(token).transfer(receiver, amount);
    }

    function refund(S.ChannelConfig calldata c, uint128 amount) external {
        require(msg.sender == c.receiver || msg.sender == c.receiverAuthorizer, "not receiver side");
        require(amount > 0, "zero");
        bytes32 id = getChannelId(c);
        ChannelState storage ch = channels[id];
        uint128 available = ch.balance - ch.totalClaimed;
        uint128 r = amount > available ? available : amount;
        if (r == 0) return;
        ch.balance -= r;
        IERC20(c.token).transfer(c.payer, r);
    }

    function initiateWithdraw(S.ChannelConfig calldata c, uint128 amount) external {
        require(msg.sender == c.payer || msg.sender == c.payerAuthorizer, "not payer side");
        bytes32 id = getChannelId(c);
        require(pending[id].initiatedAt == 0, "pending");
        require(amount <= channels[id].balance - channels[id].totalClaimed, "exceeds");
        pending[id] = Withdrawal(amount, uint40(block.timestamp));
    }

    function finalizeWithdraw(S.ChannelConfig calldata c) external {
        require(msg.sender == c.payer || msg.sender == c.payerAuthorizer, "not payer side");
        bytes32 id = getChannelId(c);
        Withdrawal memory w = pending[id];
        require(w.initiatedAt != 0, "none");
        require(block.timestamp >= uint256(w.initiatedAt) + c.withdrawDelay, "delay");
        ChannelState storage ch = channels[id];
        uint128 available = ch.balance - ch.totalClaimed;
        uint128 amt = w.amount > available ? available : w.amount;
        delete pending[id];
        ch.balance -= amt;
        if (amt > 0) IERC20(c.token).transfer(c.payer, amt);
    }
}
