// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {Test} from "forge-std/Test.sol";
import {MockAUSD} from "../src/MockAUSD.sol";
import {AgentSpend} from "../src/AgentSpend.sol";
import {IERC20} from "../src/IERC20.sol";

contract AgentSpendTest is Test {
    MockAUSD ausd;
    AgentSpend spend;
    address owner_ = address(0x0A11);
    address agent = address(0xA6E47);
    address vendor = address(0x7E4D02);
    address stranger = address(0x5717);

    function setUp() public {
        ausd = new MockAUSD();
        spend = new AgentSpend(IERC20(address(ausd)));
        ausd.mint(owner_, 500e6);
        vm.startPrank(owner_);
        ausd.approve(address(spend), type(uint256).max);
        spend.setPolicy(agent, 2e6, 5e6); // $2 per call, $5 per day
        spend.setRecipient(agent, vendor, true);
        vm.stopPrank();
    }

    function test_pays_within_caps() public {
        vm.prank(agent);
        spend.pay(owner_, vendor, 1e6, keccak256("call-1"));
        assertEq(ausd.balanceOf(vendor), 1e6);
    }

    function test_blocks_over_per_call_cap() public {
        vm.expectRevert(AgentSpend.OverPerCallCap.selector);
        vm.prank(agent);
        spend.pay(owner_, vendor, 3e6, keccak256("big"));
    }

    function test_blocks_over_daily_cap_and_resets_next_day() public {
        vm.startPrank(agent);
        spend.pay(owner_, vendor, 2e6, keccak256("a"));
        spend.pay(owner_, vendor, 2e6, keccak256("b"));
        vm.expectRevert(AgentSpend.OverDailyCap.selector);
        spend.pay(owner_, vendor, 2e6, keccak256("c"));
        skip(1 days);
        spend.pay(owner_, vendor, 2e6, keccak256("c"));
        vm.stopPrank();
        assertEq(ausd.balanceOf(vendor), 6e6);
    }

    function test_blocks_unlisted_recipient() public {
        vm.expectRevert(AgentSpend.RecipientNotAllowed.selector);
        vm.prank(agent);
        spend.pay(owner_, stranger, 1e6, keccak256("x"));
    }

    function test_blocks_replayed_ref() public {
        vm.startPrank(agent);
        spend.pay(owner_, vendor, 1e6, keccak256("dup"));
        vm.expectRevert(AgentSpend.RefAlreadyUsed.selector);
        spend.pay(owner_, vendor, 1e6, keccak256("dup"));
    }

    function test_owner_revoke_stops_agent() public {
        vm.prank(owner_);
        spend.revoke(agent);
        vm.expectRevert(AgentSpend.PolicyInactive.selector);
        vm.prank(agent);
        spend.pay(owner_, vendor, 1e6, keccak256("r"));
    }

    function test_unknown_agent_has_no_authority() public {
        vm.expectRevert(AgentSpend.PolicyInactive.selector);
        vm.prank(stranger);
        spend.pay(owner_, vendor, 1e6, keccak256("s"));
    }
}
