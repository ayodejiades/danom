// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {Test} from "forge-std/Test.sol";
import {MockAUSD} from "../src/MockAUSD.sol";
import {AgentCredit} from "../src/AgentCredit.sol";
import {IERC20} from "../src/IERC20.sol";

contract AgentCreditTest is Test {
    MockAUSD ausd;
    AgentCredit credit;

    address lender = address(0x1E4D);
    address sponsor = address(0x5B0);
    address agent = address(0xA6E47);
    address vendor = address(0x7E4D02);
    address stranger = address(0x5717);

    function setUp() public {
        ausd = new MockAUSD();
        credit = new AgentCredit(IERC20(address(ausd)));

        ausd.mint(lender, 10_000e6);
        ausd.mint(sponsor, 1_000e6);
        ausd.mint(agent, 1_000e6); // used only to show the agent repaying on its own behalf

        vm.prank(lender);
        ausd.approve(address(credit), type(uint256).max);
        vm.prank(sponsor);
        ausd.approve(address(credit), type(uint256).max);
        vm.prank(agent);
        ausd.approve(address(credit), type(uint256).max);

        vm.prank(lender);
        credit.supply(5_000e6);

        // collateral $400 -> hard ceiling $300. Base limit $100, per borrow cap $40, 10% APR, 30 days.
        vm.startPrank(sponsor);
        credit.openLine(agent, 400e6, 100e6, 40e6, 1_000, 30 days);
        credit.setVendor(agent, vendor, true);
        vm.stopPrank();
    }

    function _borrow(uint128 amount, string memory ref) internal {
        vm.prank(agent);
        credit.borrowAndPay(sponsor, vendor, amount, keccak256(bytes(ref)));
    }

    // ------------------------------------------------------------- borrowing

    function test_borrow_pays_vendor_directly_not_the_agent() public {
        uint256 agentBefore = ausd.balanceOf(agent);
        _borrow(30e6, "inv-1");
        assertEq(ausd.balanceOf(vendor), 30e6);
        assertEq(ausd.balanceOf(agent), agentBefore, "agent must never receive borrowed funds");
        assertEq(credit.debtOf(sponsor, agent), 30e6);
    }

    function test_blocks_unlisted_vendor_including_the_agent_itself() public {
        vm.startPrank(agent);
        vm.expectRevert(AgentCredit.VendorNotAllowed.selector);
        credit.borrowAndPay(sponsor, stranger, 10e6, keccak256("a"));
        vm.expectRevert(AgentCredit.VendorNotAllowed.selector);
        credit.borrowAndPay(sponsor, agent, 10e6, keccak256("b"));
    }

    function test_blocks_over_per_borrow_cap() public {
        vm.expectRevert(AgentCredit.OverPerBorrowCap.selector);
        vm.prank(agent);
        credit.borrowAndPay(sponsor, vendor, 41e6, keccak256("big"));
    }

    function test_blocks_over_credit_limit() public {
        _borrow(40e6, "1");
        _borrow(40e6, "2");
        _borrow(20e6, "3"); // exactly the $100 base limit
        vm.expectRevert(AgentCredit.OverCreditLimit.selector);
        vm.prank(agent);
        credit.borrowAndPay(sponsor, vendor, 1e6, keccak256("4"));
    }

    function test_blocks_replayed_reference() public {
        _borrow(10e6, "dup");
        vm.expectRevert(AgentCredit.RefAlreadyUsed.selector);
        vm.prank(agent);
        credit.borrowAndPay(sponsor, vendor, 10e6, keccak256("dup"));
    }

    function test_unknown_agent_and_revoked_line_cannot_borrow() public {
        vm.expectRevert(AgentCredit.LineInactive.selector);
        vm.prank(stranger);
        credit.borrowAndPay(sponsor, vendor, 1e6, keccak256("s"));

        vm.prank(sponsor);
        credit.revoke(agent);
        vm.expectRevert(AgentCredit.LineInactive.selector);
        vm.prank(agent);
        credit.borrowAndPay(sponsor, vendor, 1e6, keccak256("r"));
    }

    // -------------------------------------------------- limit grows with record

    function test_limit_grows_with_repaid_principal_but_never_past_collateral_cap() public {
        assertEq(credit.creditLimit(sponsor, agent), 100e6);
        _borrow(40e6, "1");
        _borrow(40e6, "2");
        vm.prank(sponsor);
        credit.repay(sponsor, agent, 80e6); // no time passed, so this is all principal
        assertEq(credit.creditLimit(sponsor, agent), 180e6);

        // repay a lot more over time and the ceiling stops at 75% of $400
        for (uint256 i = 0; i < 6; i++) {
            _borrow(40e6, string(abi.encodePacked("loop", i)));
            vm.prank(sponsor);
            credit.repay(sponsor, agent, 40e6);
        }
        assertEq(credit.creditLimit(sponsor, agent), 300e6);
    }

    // ---------------------------------------------------------------- interest

    function test_interest_accrues_per_second_and_repay_pays_interest_first() public {
        _borrow(40e6, "1");
        skip(365 days); // 10% APR on $40 = $4.00 (line is now overdue but that only matters to liquidate)
        assertEq(credit.debtOf(sponsor, agent), 44e6);

        vm.prank(sponsor);
        credit.repay(sponsor, agent, 10e6);
        (, , , , uint128 principal, uint128 interestOwed, uint128 repaid, , , ) = credit.lines(sponsor, agent);
        assertEq(interestOwed, 0);
        assertEq(principal, 34e6);
        assertEq(repaid, 6e6, "only principal counts toward the credit record");
    }

    function test_interest_flows_to_lenders() public {
        uint256 sharesBefore = credit.sharesOf(lender);
        _borrow(40e6, "1");
        skip(180 days);
        uint256 debt = credit.debtOf(sponsor, agent);
        vm.prank(sponsor);
        credit.repay(sponsor, agent, uint128(debt));
        assertEq(credit.debtOf(sponsor, agent), 0);

        vm.prank(lender);
        uint256 out = credit.withdrawSupply(sharesBefore);
        assertGt(out, 5_000e6, "lender earned the interest");
        assertEq(out, 5_000e6 + (debt - 40e6));
    }

    // ------------------------------------------------------------- collateral

    function test_collateral_is_never_lendable_or_withdrawable_by_lenders() public {
        // pool has $5000 cash plus $400 collateral in the same token balance
        assertEq(credit.cash(), 5_000e6);
        assertEq(credit.totalAssets(), 5_000e6);
        uint256 shares = credit.sharesOf(lender);
        vm.prank(lender);
        uint256 out = credit.withdrawSupply(shares);
        assertEq(out, 5_000e6, "lender gets exactly what they supplied, not the sponsor's collateral");
        assertEq(ausd.balanceOf(address(credit)), 400e6, "collateral is still there");
    }

    function test_close_line_returns_collateral_only_when_debt_free() public {
        _borrow(10e6, "1");
        vm.prank(sponsor);
        vm.expectRevert(AgentCredit.DebtOutstanding.selector);
        credit.closeLine(agent);

        vm.prank(sponsor);
        credit.repay(sponsor, agent, 10e6);
        uint256 before = ausd.balanceOf(sponsor);
        vm.prank(sponsor);
        credit.closeLine(agent);
        assertEq(ausd.balanceOf(sponsor), before + 400e6);
        assertEq(credit.totalCollateral(), 0);
    }

    // ------------------------------------------------------------ liquidation

    function test_cannot_liquidate_a_healthy_line() public {
        _borrow(40e6, "1");
        vm.expectRevert(AgentCredit.NotLiquidatable.selector);
        vm.prank(stranger);
        credit.liquidate(sponsor, agent);
    }

    function test_overdue_line_can_be_liquidated_and_remainder_returns_to_sponsor() public {
        _borrow(40e6, "1");
        skip(31 days);
        uint256 debt = credit.debtOf(sponsor, agent);
        uint256 before = ausd.balanceOf(sponsor);

        vm.prank(stranger);
        credit.liquidate(sponsor, agent);

        assertEq(ausd.balanceOf(sponsor) - before, 400e6 - debt);
        assertEq(credit.debtOf(sponsor, agent), 0);
        assertEq(credit.totalCollateral(), 0);
        assertEq(credit.totalBorrowed(), 0);
        // lenders were made whole, and slightly more from interest
        assertEq(credit.totalAssets(), 5_000e6 + (debt - 40e6));
    }

    function test_undercollateralized_line_can_be_liquidated_before_due_date() public {
        // A line whose interest pushes debt over 90% of a small collateral pile.
        vm.startPrank(sponsor);
        credit.closeLine(agent);
        credit.openLine(agent, 100e6, 75e6, 75e6, 10_000, 3650 days); // 100% APR
        credit.setVendor(agent, vendor, true);
        vm.stopPrank();
        _borrow(75e6, "big");
        skip(90 days); // 75 * 1.0 * 90/365 = 18.49 interest -> debt 93.49 > 90% of 100
        vm.prank(stranger);
        credit.liquidate(sponsor, agent);
        assertEq(credit.debtOf(sponsor, agent), 0);
    }

    function test_shortfall_is_absorbed_by_lenders_not_hidden() public {
        vm.startPrank(sponsor);
        credit.closeLine(agent);
        credit.openLine(agent, 100e6, 75e6, 75e6, 10_000, 3650 days);
        credit.setVendor(agent, vendor, true);
        vm.stopPrank();
        _borrow(75e6, "big");
        skip(3000 days); // interest far exceeds collateral
        uint256 assetsBefore = credit.totalAssets();
        vm.prank(stranger);
        credit.liquidate(sponsor, agent);
        assertEq(credit.totalCollateral(), 0);
        // pool lost the unrecoverable part: principal 75 lent out, only 100 collateral seized
        assertEq(credit.totalAssets(), assetsBefore - 75e6 + 100e6);
    }

    // ------------------------------------------------------------------ fuzz

    function testFuzz_pool_accounting_never_creates_money(uint128 a, uint128 b, uint32 wait) public {
        a = uint128(bound(a, 1e6, 40e6));
        b = uint128(bound(b, 1e6, 40e6));
        wait = uint32(bound(wait, 0, 20 days));
        _borrow(a, "f1");
        skip(wait);
        _borrow(b, "f2");
        uint256 debt = credit.debtOf(sponsor, agent);
        vm.prank(agent);
        credit.repay(sponsor, agent, uint128(debt));
        assertEq(credit.debtOf(sponsor, agent), 0);
        assertEq(credit.totalBorrowed(), 0);
        // token balance = lender assets + collateral, exactly
        assertEq(ausd.balanceOf(address(credit)), credit.totalAssets() + credit.totalCollateral());
    }
}
