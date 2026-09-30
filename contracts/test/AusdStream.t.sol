// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {Test} from "forge-std/Test.sol";
import {MockAUSD} from "../src/MockAUSD.sol";
import {AusdStream} from "../src/AusdStream.sol";
import {IERC20} from "../src/IERC20.sol";

contract AusdStreamTest is Test {
    MockAUSD ausd;
    AusdStream streams;
    address alice = address(0xA11CE);
    address bola = address(0xB01A);
    bytes32 constant CORRIDOR = keccak256("US>NG");

    function setUp() public {
        ausd = new MockAUSD();
        streams = new AusdStream(IERC20(address(ausd)));
        ausd.mint(alice, 1_000e6);
        vm.prank(alice);
        ausd.approve(address(streams), type(uint256).max);
    }

    function _open(uint128 amount, uint64 dur) internal returns (uint256) {
        vm.prank(alice);
        return streams.openStream(bola, amount, dur, CORRIDOR, bytes32(0));
    }

    function test_accrues_linearly() public {
        uint256 id = _open(100e6, 100);
        skip(25);
        assertEq(streams.accrued(id), 25e6);
        vm.prank(bola);
        assertEq(streams.withdraw(id), 25e6);
        skip(25);
        assertEq(streams.withdrawable(id), 25e6);
    }

    function test_full_duration_pays_everything() public {
        uint256 id = _open(100e6, 60);
        skip(600);
        vm.prank(bola);
        streams.withdraw(id);
        assertEq(ausd.balanceOf(bola), 100e6);
        assertEq(ausd.balanceOf(address(streams)), 0);
    }

    function test_cancel_splits_accrued_and_remainder() public {
        uint256 id = _open(100e6, 100);
        skip(40);
        vm.prank(alice);
        streams.cancel(id);
        assertEq(ausd.balanceOf(bola), 40e6);
        assertEq(ausd.balanceOf(alice), 1_000e6 - 40e6);
        assertEq(ausd.balanceOf(address(streams)), 0);
    }

    function test_cancel_after_partial_withdraw_does_not_double_pay() public {
        uint256 id = _open(100e6, 100);
        skip(30);
        vm.prank(bola);
        streams.withdraw(id);
        skip(20);
        vm.prank(alice);
        streams.cancel(id);
        assertEq(ausd.balanceOf(bola), 50e6);
        assertEq(ausd.balanceOf(alice), 1_000e6 - 50e6);
    }

    function test_only_recipient_withdraws_only_sender_cancels() public {
        uint256 id = _open(100e6, 100);
        skip(10);
        vm.expectRevert(AusdStream.NotRecipient.selector);
        vm.prank(alice);
        streams.withdraw(id);
        vm.expectRevert(AusdStream.NotSender.selector);
        vm.prank(bola);
        streams.cancel(id);
    }

    function test_cannot_cancel_twice() public {
        uint256 id = _open(100e6, 100);
        vm.startPrank(alice);
        streams.cancel(id);
        vm.expectRevert(AusdStream.AlreadyCancelled.selector);
        streams.cancel(id);
    }

    function testFuzz_conservation(uint128 amount, uint64 dur, uint64 t1, uint64 t2) public {
        amount = uint128(bound(amount, 1, 1_000e6));
        dur = uint64(bound(dur, 1, 365 days));
        t1 = uint64(bound(t1, 0, 2 * uint256(dur)));
        t2 = uint64(bound(t2, 0, 2 * uint256(dur)));
        uint256 id = _open(amount, dur);
        skip(t1);
        if (streams.withdrawable(id) > 0) {
            vm.prank(bola);
            streams.withdraw(id);
        }
        skip(t2);
        vm.prank(alice);
        streams.cancel(id);
        // every unit is either with the recipient, the sender, or nowhere else
        assertEq(ausd.balanceOf(bola) + (ausd.balanceOf(alice) - (1_000e6 - amount)), amount);
        assertEq(ausd.balanceOf(address(streams)), 0);
    }
}
