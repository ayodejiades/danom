// tests/credit.test.mjs — the TypeScript mirror of CreditVault, pinned to the Foundry test numbers and to
// the run recorded in PROOF_RUNS.json (real x402 contract on an Anvil fork of Monad testnet).
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { creditLimit, checkFunding, debtAt, isLiquidatable, ltvBpsOf, routeRevenue, splitRepayment, tierOf } from "../lib/credit.ts";
import { fromUnits, receiptDigest, toUnits } from "../lib/stream.ts";

const proof = JSON.parse(fs.readFileSync(new URL("../PROOF_RUNS.json", import.meta.url), "utf8"));
const run = (id) => proof.runs.find((r) => r.id === id);

const fresh = { repaidPrincipal: 0n, revenueRouted: 0n, defaults: 0 };
const line = {
  active: true, collateral: toUnits(400), baseLimit: toUnits(100), perBorrowCap: toUnits(40), principal: 0n, interestOwed: 0n,
  aprBps: 1000, repayShareBps: 5000, lastAccrual: 1000, dueAt: 1000 + 30 * 86400, allowedReceivers: ["0xAbC0000000000000000000000000000000000001"],
};
const vendor = "0xabc0000000000000000000000000000000000001";

test("tiers follow lifetime repaid principal and a default pins tier zero", () => {
  assert.equal(tierOf(fresh), 0);
  assert.equal(tierOf({ ...fresh, repaidPrincipal: toUnits(100) }), 1);
  assert.equal(tierOf({ ...fresh, repaidPrincipal: toUnits(500) }), 2);
  assert.equal(tierOf({ ...fresh, repaidPrincipal: toUnits(2000) }), 3);
  assert.equal(tierOf({ repaidPrincipal: toUnits(5000), revenueRouted: 0n, defaults: 1 }), 0);
  assert.equal(ltvBpsOf({ ...fresh, repaidPrincipal: toUnits(120) }), 10000);
});

test("credit limit is base plus repaid, capped by collateral at the tier (matches the Foundry numbers)", () => {
  assert.equal(creditLimit(line, fresh), toUnits(100));
  const graduated = { ...fresh, repaidPrincipal: toUnits(120) };
  assert.equal(creditLimit(line, graduated), toUnits(220));
  assert.equal(creditLimit({ ...line, collateral: toUnits(100), baseLimit: toUnits(90) }, graduated), toUnits(100));
});

test("funding checks run in the same order as CreditVault.fundChannel", () => {
  assert.equal(checkFunding(line, fresh, vendor, toUnits(30), 2000, toUnits(5000)).ok, true);
  assert.equal(checkFunding({ ...line, active: false }, fresh, vendor, 1n, 2000, toUnits(5000)).reason, "LineInactive");
  assert.equal(checkFunding(line, fresh, vendor, 1n, line.dueAt, toUnits(5000)).reason, "LineExpired");
  assert.equal(checkFunding(line, fresh, "0xdead", 1n, 2000, toUnits(5000)).reason, "ReceiverNotAllowed");
  assert.equal(checkFunding(line, fresh, vendor, toUnits(41), 2000, toUnits(5000)).reason, "OverPerBorrowCap");
  assert.equal(checkFunding({ ...line, principal: toUnits(100) }, fresh, vendor, toUnits(1), 1000, toUnits(5000)).reason, "OverCreditLimit");
});

test("interest, repayment order and revenue routing", () => {
  const owed = { ...line, principal: toUnits(40) };
  assert.equal(debtAt(owed, 1000 + 365 * 86400), toUnits(44));
  const s = splitRepayment(owed, toUnits(10), 1000 + 365 * 86400);
  assert.equal(s.interestPaid, toUnits(4));
  assert.equal(s.principalPaid, toUnits(6));
  const r = routeRevenue(owed, toUnits(100), 1000);
  assert.equal(r.toDebt, toUnits(40));
  assert.equal(r.toAgent, toUnits(60));
  assert.equal(routeRevenue({ ...owed, principal: toUnits(100) }, toUnits(60), 1000).toDebt, toUnits(30));
});

test("liquidation: overdue, and undercollateralized at the tier's buffer", () => {
  const owed = { ...line, principal: toUnits(40) };
  assert.equal(isLiquidatable(owed, fresh, 2000).liquidatable, false);
  assert.equal(isLiquidatable(owed, fresh, line.dueAt + 1).why, "overdue");
  const small = { ...line, collateral: toUnits(100), principal: toUnits(91), dueAt: 10 ** 9 };
  assert.equal(isLiquidatable(small, fresh, 1000).why, "undercollateralized"); // 91 > 90% of 100
});

// ---------------------------------------------------------------- the recorded run
test("PROOF_RUNS.json is a fork of Monad testnet against the canonical x402 contract, and says so", () => {
  assert.equal(proof.verificationMode, "ANVIL_FORK_MONAD_TESTNET");
  assert.equal(proof.contracts.x402BatchSettlement, "0x4020074e9dF2ce1deE5A9C1b5c3f541D02a10003");
  assert.ok(proof.note.includes("nothing was broadcast to Monad"));
  assert.ok(proof.x402Events.some((e) => e.event === "Deposited"));
  assert.ok(proof.x402Events.some((e) => e.event === "Claimed"));
  assert.ok(proof.x402Events.some((e) => e.event === "Settled"));
});

test("run 1: the agent held no tokens, the vault paid, a refund did not move the share price before reconcile", () => {
  const r = run("run-01-channel");
  assert.equal(r.agentTokensChangeAusd, "0.00");
  assert.equal(r.escrowedAusd, "40.00");
  assert.equal(r.vendorReceivedAusd, "25.00");
  assert.equal(r.unbookedRefundAusd, "15.00");
  assert.equal(r.shareValueBeforeReconcileAusd, r.shareValueAfterReconcileAusd);
  assert.equal(r.debtAfterReconcileAusd, "25.00");
});

test("run 2 to 5: graduation, revenue routing, portable record, default", () => {
  const g = run("run-02-graduation");
  assert.deepEqual([g.tierBefore, g.tierAfter, g.ltvBpsBefore, g.ltvBpsAfter], [0, 1, 7500, 10000]);
  const mirrored = fromUnits(creditLimit(line, { ...fresh, repaidPrincipal: toUnits(145) }), 2);
  assert.equal(g.creditLimitAfterAusd, mirrored, "the TypeScript mirror gives the same ceiling the chain did");
  assert.equal(mirrored, "245.00");
  const rev = run("run-03-revenue");
  assert.equal(rev.agentReceivedAusd, "60.00");
  assert.equal(rev.debtAfterAusd, "0.00");
  assert.equal(run("run-04-portable-record").sponsor2CreditLimitAusd, "100.00");
  const d = run("run-05-default");
  assert.deepEqual([d.defaults, d.tierAfter, d.ltvBpsAfter], [1, 0, 7500]);
});

test("every refusal on record matches its expected error, from the vault or the real x402 contract", () => {
  const refusals = run("refusals").refusals;
  assert.ok(refusals.length >= 8);
  for (const a of refusals) assert.equal(a.refusedWith, a.expected, a.attempt);
});

test("receipt digests recompute from their own fields and change on a 1 unit edit", () => {
  assert.ok(proof.receipts.length >= 10);
  for (const r of proof.receipts) {
    const base = { chainId: proof.chainId, contract: proof.contracts.CreditVault, kind: r.kind, id: r.id, from: r.from, to: r.to, txHash: r.txHash };
    assert.equal(receiptDigest({ ...base, amount: BigInt(r.amountUnits) }), r.digest);
    assert.notEqual(receiptDigest({ ...base, amount: BigInt(r.amountUnits) + 1n }), r.digest);
  }
});
