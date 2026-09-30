// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {Test} from "forge-std/Test.sol";
import {MockAUSD} from "../src/MockAUSD.sol";
import {ChannelFunder} from "../src/ChannelFunder.sol";
import {IERC20} from "../src/IERC20.sol";
import {IX402BatchSettlement as S} from "../src/interfaces/IX402BatchSettlement.sol";

/// Runs against the REAL x402BatchSettlement deployed on Monad. Run with:
///   forge test --match-contract ChannelFunderFork --fork-url https://testnet-rpc.monad.xyz -vv
/// On any other chain (plain `forge test`) every test returns early, so the normal suite stays offline.
contract ChannelFunderForkTest is Test {
    S constant SETTLEMENT = S(0x4020074e9dF2ce1deE5A9C1b5c3f541D02a10003);

    MockAUSD token;
    ChannelFunder funder;

    address vendor = address(0x7E4D02);
    address vendorAuth = address(0xA07403);
    address stranger = address(0x5717);
    uint256 agentKey = uint256(keccak256("agent-voucher-key"));
    address agent;

    modifier onFork() {
        if (block.chainid != 10143 && block.chainid != 143) return;
        _;
    }

    function setUp() public {
        if (block.chainid != 10143 && block.chainid != 143) return;
        agent = vm.addr(agentKey);
        token = new MockAUSD();
        funder = new ChannelFunder(SETTLEMENT, IERC20(address(token)));
        token.mint(address(funder), 1_000e6); // stands in for lender deposits

        // credit policy: $50 per channel, $120 total line, valid for 7 days
        funder.setPolicy(agent, 50e6, 120e6, uint64(block.timestamp + 7 days));
        funder.setReceiver(vendor, vendorAuth);
    }

    function _config(bytes32 salt) internal view returns (S.ChannelConfig memory) {
        return S.ChannelConfig({
            payer: address(funder),
            payerAuthorizer: agent,
            receiver: vendor,
            receiverAuthorizer: vendorAuth,
            token: address(token),
            withdrawDelay: 15 minutes,
            salt: salt
        });
    }

    function _fund(uint128 amount, bytes32 salt) internal returns (bytes32 id) {
        vm.prank(agent);
        id = funder.fundChannel(vendor, 15 minutes, salt, amount);
    }

    function _voucherSig(bytes32 id, uint128 cumulative, uint256 key) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, SETTLEMENT.getVoucherDigest(id, cumulative));
        return abi.encodePacked(r, s, v);
    }

    function _claim(S.ChannelConfig memory c, uint128 cumulative, bytes memory sig, address by) internal {
        S.VoucherClaim[] memory claims = new S.VoucherClaim[](1);
        claims[0] = S.VoucherClaim({voucher: S.Voucher({channel: c, maxClaimableAmount: cumulative}), signature: sig, totalClaimed: cumulative});
        vm.prank(by);
        SETTLEMENT.claim(claims);
    }

    // ------------------------------------------------------------- happy path

    function test_fork_fund_voucher_claim_settle_on_real_contracts() public onFork {
        bytes32 id = _fund(50e6, bytes32(uint256(1)));
        (uint128 balance, uint128 claimed) = SETTLEMENT.channels(id);
        assertEq(balance, 50e6, "escrow holds the deposit");
        assertEq(claimed, 0);
        assertEq(token.balanceOf(address(funder)), 950e6, "vault paid the escrow");
        assertEq(token.balanceOf(agent), 0, "agent never held tokens");

        // the agent signs an off chain voucher for $12.30, vendor claims and settles
        S.ChannelConfig memory c = _config(bytes32(uint256(1)));
        bytes memory sig = _voucherSig(id, 12_300_000, agentKey);
        _claim(c, 12_300_000, sig, vendorAuth);
        SETTLEMENT.settle(vendor, address(token));
        assertEq(token.balanceOf(vendor), 12_300_000);

        // a later, larger cumulative voucher supersedes the first; only the delta moves
        bytes memory sig2 = _voucherSig(id, 20e6, agentKey);
        _claim(c, 20e6, sig2, vendorAuth);
        SETTLEMENT.settle(vendor, address(token));
        assertEq(token.balanceOf(vendor), 20e6);
        assertEq(token.balanceOf(agent), 0);
    }

    function test_fork_vendor_refunds_unused_escrow_to_the_vault() public onFork {
        bytes32 id = _fund(50e6, bytes32(uint256(2)));
        S.ChannelConfig memory c = _config(bytes32(uint256(2)));
        _claim(c, 10e6, _voucherSig(id, 10e6, agentKey), vendorAuth);
        vm.prank(vendorAuth);
        SETTLEMENT.refund(c, 50e6); // capped to the 40 that is unclaimed
        assertEq(token.balanceOf(address(funder)), 950e6 + 40e6);
        SETTLEMENT.settle(vendor, address(token));
        assertEq(token.balanceOf(vendor), 10e6);
    }

    // ---------------------------------------------------- policy refusals

    function test_fork_policy_refusals() public onFork {
        vm.startPrank(agent);
        vm.expectRevert(ChannelFunder.OverPerFundCap.selector);
        funder.fundChannel(vendor, 15 minutes, bytes32(uint256(3)), 51e6);

        vm.expectRevert(ChannelFunder.ReceiverNotAllowed.selector);
        funder.fundChannel(agent, 15 minutes, bytes32(uint256(3)), 10e6); // the agent paying itself
        vm.expectRevert(ChannelFunder.ReceiverNotAllowed.selector);
        funder.fundChannel(stranger, 15 minutes, bytes32(uint256(3)), 10e6);
        vm.stopPrank();

        vm.prank(stranger);
        vm.expectRevert(ChannelFunder.NotAgent.selector);
        funder.fundChannel(vendor, 15 minutes, bytes32(uint256(3)), 10e6);

        // credit line: 50 + 50 fit inside 120, a third 50 does not
        _fund(50e6, bytes32(uint256(10)));
        _fund(50e6, bytes32(uint256(11)));
        vm.prank(agent);
        vm.expectRevert(ChannelFunder.OverCreditLine.selector);
        funder.fundChannel(vendor, 15 minutes, bytes32(uint256(12)), 50e6);
    }

    function test_fork_revoke_and_expiry_block_new_funding_but_not_signed_claims() public onFork {
        bytes32 id = _fund(50e6, bytes32(uint256(4)));
        bytes memory sig = _voucherSig(id, 5e6, agentKey);

        funder.revoke();
        vm.prank(agent);
        vm.expectRevert(ChannelFunder.PolicyInactive.selector);
        funder.fundChannel(vendor, 15 minutes, bytes32(uint256(5)), 10e6);

        // the honest limit: a voucher signed before revoke is still claimable against escrow already committed
        _claim(_config(bytes32(uint256(4))), 5e6, sig, vendorAuth);
        (, uint128 claimed) = SETTLEMENT.channels(id);
        assertEq(claimed, 5e6);
    }

    function test_fork_expiry_blocks_funding() public onFork {
        skip(8 days);
        vm.prank(agent);
        vm.expectRevert(ChannelFunder.PolicyExpired.selector);
        funder.fundChannel(vendor, 15 minutes, bytes32(uint256(6)), 10e6);
    }

    // ------------------------------------------------- what the chain refuses

    function test_fork_voucher_signed_by_anyone_but_the_agent_fails() public onFork {
        bytes32 id = _fund(50e6, bytes32(uint256(7)));
        bytes memory forged = _voucherSig(id, 10e6, uint256(keccak256("someone else")));
        vm.expectRevert(); // InvalidSignature
        this._claimExternal(_config(bytes32(uint256(7))), 10e6, forged, vendorAuth);
    }

    function test_fork_claim_above_escrow_fails() public onFork {
        bytes32 id = _fund(50e6, bytes32(uint256(8)));
        bytes memory sig = _voucherSig(id, 60e6, agentKey);
        vm.expectRevert(); // ClaimExceedsBalance
        this._claimExternal(_config(bytes32(uint256(8))), 60e6, sig, vendorAuth);
    }

    function test_fork_direct_deposit_cannot_pull_from_the_vault() public onFork {
        // Anyone may call settlement.deposit with any collector. Naming the vault as collector must fail,
        // because the vault only releases tokens for a deposit it authorised in fundChannel.
        S.ChannelConfig memory c = _config(bytes32(uint256(9)));
        vm.prank(stranger);
        vm.expectRevert(ChannelFunder.UnauthorizedCollect.selector);
        SETTLEMENT.deposit(c, 10e6, address(funder), "");
        assertEq(token.balanceOf(address(funder)), 1_000e6);
    }

    function test_fork_after_revoke_escrow_returns_after_the_withdraw_delay() public onFork {
        bytes32 id = _fund(50e6, bytes32(uint256(13)));
        S.ChannelConfig memory c = _config(bytes32(uint256(13)));

        vm.expectRevert(ChannelFunder.StillActive.selector);
        funder.reclaim(c, 50e6);

        funder.revoke();
        vm.prank(stranger); // anyone may start the reclaim
        funder.reclaim(c, 50e6);
        vm.expectRevert(); // WithdrawDelayNotElapsed
        vm.prank(stranger);
        funder.finalizeReclaim(c);

        skip(15 minutes);
        // the funder (payer) or the agent (payerAuthorizer) may finalize
        vm.prank(agent);
        SETTLEMENT.finalizeWithdraw(c);
        assertEq(token.balanceOf(address(funder)), 1_000e6, "all escrow came home");
        (uint128 balance,) = SETTLEMENT.channels(id);
        assertEq(balance, 0);
    }

    function _claimExternal(S.ChannelConfig memory c, uint128 cumulative, bytes memory sig, address by) external {
        _claim(c, cumulative, sig, by);
    }
}
