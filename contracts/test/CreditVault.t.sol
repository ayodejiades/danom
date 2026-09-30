// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {Test} from "forge-std/Test.sol";
import {MockAUSD} from "../src/MockAUSD.sol";
import {CreditVault} from "../src/CreditVault.sol";
import {IERC20} from "../src/IERC20.sol";
import {IX402BatchSettlement as S} from "../src/interfaces/IX402BatchSettlement.sol";
import {MockX402Settlement} from "./mocks/MockX402Settlement.sol";

/// Runs offline against MockX402Settlement, and against the REAL canonical x402BatchSettlement when the
/// chain is Monad: forge test --match-contract CreditVaultTest --fork-url https://testnet-rpc.monad.xyz
contract CreditVaultTest is Test {
    S settlement;
    MockAUSD token;
    CreditVault vault;

    address lender = address(0x1E4D);
    address sponsor = address(0x5B0);
    address sponsor2 = address(0x5B2);
    address vendor = address(0x7E4D02);
    address vendorAuth = address(0xA07403);
    address customer = address(0xC057);
    address stranger = address(0x5717);
    uint256 agentKey = uint256(keccak256("agent-voucher-key"));
    address agent;

    function setUp() public {
        agent = vm.addr(agentKey);
        if (block.chainid == 10143 || block.chainid == 143) {
            settlement = S(0x4020074e9dF2ce1deE5A9C1b5c3f541D02a10003);
        } else {
            settlement = S(address(new MockX402Settlement()));
        }
        token = new MockAUSD();
        vault = new CreditVault(settlement, IERC20(address(token)));

        token.mint(lender, 10_000e6);
        token.mint(sponsor, 2_000e6);
        token.mint(sponsor2, 500e6);
        token.mint(customer, 5_000e6);
        token.mint(agent, 1_000e6); // used only to show the agent repaying its own debt
        address[6] memory who = [lender, sponsor, sponsor2, customer, agent, address(this)];
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(who[i]);
            token.approve(address(vault), type(uint256).max);
        }

        vm.prank(lender);
        vault.supply(5_000e6);

        // collateral $400, base limit $100, per channel cap $40, 10% APR, 30 days, 50% of revenue to debt
        vm.startPrank(sponsor);
        vault.openLine(agent, 400e6, 100e6, 40e6, 1_000, 30 days, 5_000);
        vault.setVendor(agent, vendor, vendorAuth);
        vault.setRevenuePayer(agent, customer, true);
        vm.stopPrank();
    }

    // ---------------------------------------------------------------- helpers

    function _fund(uint128 amount, uint256 salt) internal returns (bytes32 id) {
        vm.prank(agent);
        id = vault.fundChannel(sponsor, vendor, 15 minutes, bytes32(salt), amount);
    }

    function _config(uint256 salt) internal view returns (S.ChannelConfig memory) {
        return S.ChannelConfig({
            payer: address(vault), payerAuthorizer: agent, receiver: vendor, receiverAuthorizer: vendorAuth,
            token: address(token), withdrawDelay: 15 minutes, salt: bytes32(salt)
        });
    }

    function _sign(bytes32 id, uint128 cumulative, uint256 key) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, settlement.getVoucherDigest(id, cumulative));
        return abi.encodePacked(r, s, v);
    }

    function _claim(uint256 salt, uint128 cumulative, bytes memory sig) internal {
        S.VoucherClaim[] memory cl = new S.VoucherClaim[](1);
        cl[0] = S.VoucherClaim({voucher: S.Voucher({channel: _config(salt), maxClaimableAmount: cumulative}), signature: sig, totalClaimed: cumulative});
        vm.prank(vendorAuth);
        settlement.claim(cl);
    }

    function _repay(uint128 amount) internal {
        vm.prank(sponsor);
        vault.repay(sponsor, agent, amount);
    }

    // ---------------------------------------------------------------- funding

    function test_funding_escrows_to_the_channel_and_the_agent_never_holds_tokens() public {
        uint256 agentBefore = token.balanceOf(agent);
        bytes32 id = _fund(30e6, 1);
        (uint128 balance,) = settlement.channels(id);
        assertEq(balance, 30e6);
        assertEq(token.balanceOf(agent), agentBefore);
        assertEq(vault.debtOf(sponsor, agent), 30e6);
        assertEq(vault.cash(), 5_000e6 - 30e6);
    }

    function test_vendor_claims_signed_vouchers_and_settles() public {
        bytes32 id = _fund(40e6, 2);
        _claim(2, 12_300_000, _sign(id, 12_300_000, agentKey));
        settlement.settle(vendor, address(token));
        assertEq(token.balanceOf(vendor), 12_300_000);
        _claim(2, 25e6, _sign(id, 25e6, agentKey));
        settlement.settle(vendor, address(token));
        assertEq(token.balanceOf(vendor), 25e6);
    }

    function test_policy_refusals() public {
        vm.startPrank(agent);
        vm.expectRevert(CreditVault.ReceiverNotAllowed.selector);
        vault.fundChannel(sponsor, agent, 15 minutes, bytes32(uint256(9)), 10e6); // agent paying itself
        vm.expectRevert(CreditVault.ReceiverNotAllowed.selector);
        vault.fundChannel(sponsor, stranger, 15 minutes, bytes32(uint256(9)), 10e6);
        vm.expectRevert(CreditVault.OverPerBorrowCap.selector);
        vault.fundChannel(sponsor, vendor, 15 minutes, bytes32(uint256(9)), 41e6);
        vm.stopPrank();

        vm.prank(stranger);
        vm.expectRevert(CreditVault.LineInactive.selector);
        vault.fundChannel(sponsor, vendor, 15 minutes, bytes32(uint256(9)), 10e6);
    }

    function test_credit_ceiling_and_revoke_and_expiry() public {
        _fund(40e6, 1);
        _fund(40e6, 2);
        _fund(20e6, 3); // exactly the $100 base ceiling
        vm.prank(agent);
        vm.expectRevert(CreditVault.OverCreditLimit.selector);
        vault.fundChannel(sponsor, vendor, 15 minutes, bytes32(uint256(4)), 1e6);

        vm.prank(sponsor);
        vault.revoke(agent);
        vm.prank(agent);
        vm.expectRevert(CreditVault.LineInactive.selector);
        vault.fundChannel(sponsor, vendor, 15 minutes, bytes32(uint256(5)), 1e6);
    }

    function test_expiry_blocks_funding() public {
        skip(31 days);
        vm.prank(agent);
        vm.expectRevert(CreditVault.LineExpired.selector);
        vault.fundChannel(sponsor, vendor, 15 minutes, bytes32(uint256(6)), 1e6);
    }

    function test_direct_deposit_cannot_pull_from_the_vault() public {
        S.ChannelConfig memory c = _config(7);
        vm.prank(stranger);
        vm.expectRevert(CreditVault.UnauthorizedCollect.selector);
        settlement.deposit(c, 10e6, address(vault), "");
        assertEq(vault.cash(), 5_000e6);
    }

    function test_voucher_from_any_key_but_the_agent_is_refused() public {
        bytes32 id = _fund(40e6, 8);
        bytes memory forged = _sign(id, 10e6, uint256(keccak256("someone else")));
        S.VoucherClaim[] memory cl = new S.VoucherClaim[](1);
        cl[0] = S.VoucherClaim({voucher: S.Voucher({channel: _config(8), maxClaimableAmount: 10e6}), signature: forged, totalClaimed: 10e6});
        vm.prank(vendorAuth);
        vm.expectRevert();
        settlement.claim(cl);
    }

    // ------------------------------------------------- accounting and reconcile

    function test_a_refund_cannot_inflate_the_share_price_before_reconcile() public {
        bytes32 id = _fund(40e6, 1);
        uint256 navBefore = vault.totalAssets();
        vm.prank(vendorAuth);
        settlement.refund(_config(1), 40e6); // 40 tokens arrive at the vault with no callback
        assertEq(token.balanceOf(address(vault)) - vault.accounted(), 40e6, "unbooked tokens sit idle");
        assertEq(vault.totalAssets(), navBefore, "share price unchanged until reconcile");

        vault.reconcile(_config(1));
        assertEq(vault.debtOf(sponsor, agent), 0, "undrawn credit is given back");
        assertEq(vault.totalAssets(), navBefore, "still the same value, now all cash");
        assertEq(vault.cash(), 5_000e6);
        id;
    }

    function test_reconcile_is_idempotent() public {
        _fund(40e6, 1);
        vm.prank(vendorAuth);
        settlement.refund(_config(1), 15e6);
        vault.reconcile(_config(1));
        vault.reconcile(_config(1));
        assertEq(vault.debtOf(sponsor, agent), 25e6);
    }

    function test_reclaim_after_revoke_returns_escrow_after_the_delay() public {
        _fund(40e6, 1);
        vm.expectRevert(CreditVault.StillActive.selector);
        vault.reclaim(_config(1), 40e6);

        vm.prank(sponsor);
        vault.revoke(agent);
        vm.prank(stranger);
        vault.reclaim(_config(1), 40e6);
        vm.expectRevert();
        vault.finalizeReclaim(_config(1));
        skip(15 minutes);
        vault.finalizeReclaim(_config(1));
        vault.reconcile(_config(1));
        assertEq(vault.debtOf(sponsor, agent), 0);
        assertEq(vault.cash(), 5_000e6);
    }

    // ---------------------------------------------------- interest and repayment

    function test_interest_accrues_and_repay_pays_interest_first() public {
        _fund(40e6, 1);
        skip(365 days);
        assertEq(vault.debtOf(sponsor, agent), 44e6);
        _repay(10e6);
        (uint256 repaid,,,,) = vault.recordOf(agent);
        assertEq(repaid, 6e6, "only principal counts toward the record");
        assertEq(vault.debtOf(sponsor, agent), 34e6);
    }

    function test_interest_reaches_lenders() public {
        _fund(40e6, 1);
        skip(180 days);
        uint256 debt = vault.debtOf(sponsor, agent);
        _repay(uint128(debt));
        // the escrow is still out (never claimed); return it so the lender can exit in full
        vm.prank(vendorAuth);
        settlement.refund(_config(1), 40e6);
        vault.reconcile(_config(1));
        uint256 shares = vault.sharesOf(lender);
        vm.prank(lender);
        uint256 out = vault.withdrawSupply(shares);
        assertGt(out, 5_000e6);
    }

    // ------------------------------------------- graduating collateral and record

    function test_record_raises_the_tier_and_the_credit_supported_by_collateral() public {
        (, , , uint256 t0, uint256 ltv0) = vault.recordOf(agent);
        assertEq(t0, 0);
        assertEq(ltv0, 7_500);
        assertEq(vault.creditLimit(sponsor, agent), 100e6); // base 100, hard cap 300

        for (uint256 i = 0; i < 3; i++) {
            _fund(40e6, 100 + i);
            _repay(40e6);
        }
        (uint256 repaid, , , uint256 t1, uint256 ltv1) = vault.recordOf(agent);
        assertEq(repaid, 120e6);
        assertEq(t1, 1);
        assertEq(ltv1, 10_000);
        assertEq(vault.creditLimit(sponsor, agent), 220e6); // base 100 + repaid 120, under the 400 cap
    }

    function _graduate() internal {
        for (uint256 i = 0; i < 3; i++) {
            _fund(40e6, 100 + i);
            _repay(40e6);
        }
    }

    function test_the_record_is_portable_to_a_new_sponsor() public {
        _graduate(); // tier 1
        address fresh = address(0xF4E5);

        // a brand new agent may borrow at most 75% of collateral as its base limit
        vm.prank(sponsor2);
        vm.expectRevert(CreditVault.BadTerms.selector);
        vault.openLine(fresh, 100e6, 90e6, 40e6, 1_000, 30 days, 5_000);

        // the proven agent gets the tier 1 ratio with a different sponsor
        vm.prank(sponsor2);
        vault.openLine(agent, 100e6, 90e6, 40e6, 1_000, 30 days, 5_000);
        assertEq(vault.creditLimit(sponsor2, agent), 100e6, "min(90 base + 120 repaid, 100 collateral at 100%)");
    }

    function test_a_default_pins_the_agent_to_tier_zero() public {
        _graduate();
        _fund(40e6, 200);
        skip(31 days);
        vault.liquidate(sponsor, agent);
        (, , uint256 defaults, uint256 tier, uint256 ltv) = vault.recordOf(agent);
        assertEq(defaults, 1);
        assertEq(tier, 0);
        assertEq(ltv, 7_500);
    }

    // ---------------------------------------------------------- revenue router

    function test_revenue_repays_the_loan_first_and_the_rest_goes_to_the_agent() public {
        _fund(40e6, 1);
        uint256 agentBefore = token.balanceOf(agent);
        vm.prank(customer);
        vault.receiveRevenue(sponsor, agent, 100e6);
        // 50% share = 50, but only 40 is owed, so 40 to debt and 60 to the agent
        assertEq(vault.debtOf(sponsor, agent), 0);
        assertEq(token.balanceOf(agent) - agentBefore, 60e6);
        (uint256 repaid, uint256 revenue,,,) = vault.recordOf(agent);
        assertEq(repaid, 40e6);
        assertEq(revenue, 100e6);
    }

    function test_revenue_share_applies_when_debt_is_larger() public {
        _fund(40e6, 1);
        _fund(40e6, 2);
        _fund(20e6, 3); // debt 100
        vm.prank(customer);
        vault.receiveRevenue(sponsor, agent, 60e6); // 50% -> 30 to debt
        assertEq(vault.debtOf(sponsor, agent), 70e6);
    }

    function test_only_allowlisted_payers_count_as_revenue() public {
        token.mint(stranger, 100e6);
        vm.prank(stranger);
        token.approve(address(vault), type(uint256).max);
        vm.prank(stranger);
        vm.expectRevert(CreditVault.PayerNotAllowed.selector);
        vault.receiveRevenue(sponsor, agent, 10e6);
    }

    // ------------------------------------------------------------- liquidation

    function test_overdue_line_liquidates_and_the_remainder_returns_to_the_sponsor() public {
        _fund(40e6, 1);
        skip(31 days);
        uint256 debt = vault.debtOf(sponsor, agent);
        uint256 before = token.balanceOf(sponsor);
        vm.prank(stranger);
        vault.liquidate(sponsor, agent);
        assertEq(token.balanceOf(sponsor) - before, 400e6 - debt);
        assertEq(vault.totalCollateral(), 0);
        assertEq(vault.totalBorrowed(), 0);
    }

    function test_cannot_liquidate_a_healthy_line() public {
        _fund(40e6, 1);
        vm.prank(stranger);
        vm.expectRevert(CreditVault.NotLiquidatable.selector);
        vault.liquidate(sponsor, agent);
    }

    function test_collateral_is_never_lender_money() public {
        assertEq(vault.totalAssets(), 5_000e6);
        uint256 shares = vault.sharesOf(lender);
        vm.prank(lender);
        assertEq(vault.withdrawSupply(shares), 5_000e6);
        assertEq(token.balanceOf(address(vault)), 400e6);
    }

    // ----------------------------------------------------------------- fuzz

    function testFuzz_the_vault_never_holds_less_than_it_has_booked(uint128 a, uint128 b, uint32 wait) public {
        a = uint128(bound(a, 1e6, 40e6));
        b = uint128(bound(b, 1e6, 40e6));
        wait = uint32(bound(wait, 0, 20 days));
        _fund(a, 1);
        skip(wait);
        _fund(b, 2);
        uint256 debt = vault.debtOf(sponsor, agent);
        vm.prank(agent);
        vault.repay(sponsor, agent, uint128(debt));
        assertEq(token.balanceOf(address(vault)), vault.accounted());
        assertEq(vault.accounted(), vault.cash() + vault.totalCollateral());
    }
}
