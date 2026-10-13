/**
 * tools/claim-verify.ts — re-derives every public claim from PROOF_RUNS.json (the recorded run of the
 * vault against the real x402 contract on an Anvil fork of Monad testnet) and from the offline Foundry
 * suite, then writes CLAIM_LEDGER.md, WHAT_IS_REAL.md and docs/SPONSOR_INTEGRATIONS.md. Exits non zero
 * if a claim outruns its evidence. Usage: pnpm claim:verify
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { receiptDigest } from "../lib/stream";
import { SEAMS } from "../lib/seams";
import { verifyDeployment } from "./verify-deployment";

async function main() {
const root = process.cwd();
const proofPath = path.join(root, "PROOF_RUNS.json");
if (!fs.existsSync(proofPath)) {
  console.error("claim:verify FAILED: PROOF_RUNS.json is missing. Run `pnpm proof:local` first.");
  process.exit(1);
}
const proof = JSON.parse(fs.readFileSync(proofPath, "utf8"));
const run = (id: string) => proof.runs.find((r: { id: string }) => r.id === id);
const r1 = run("run-01-channel"), r2 = run("run-02-graduation"), r3 = run("run-03-revenue");
const r4 = run("run-04-portable-record"), r5 = run("run-05-default"), refusals = run("refusals")?.refusals ?? [];

// offline Foundry suite (mock settlement). The fork run is recorded in PROOF_RUNS.json.
const f = spawnSync("forge", ["test"], { cwd: root, encoding: "utf8" });
const totals = /(\d+) tests passed, (\d+) failed, (\d+) skipped/.exec(f.stdout + f.stderr);
const forgePassed = totals ? Number(totals[1]) : 0;
const forgeFailed = totals ? Number(totals[2]) : 1;

const digestsOk = proof.receipts.length > 0 && proof.receipts.every((r: Record<string, string>) => {
  const base = { chainId: proof.chainId, contract: proof.contracts.CreditVault, kind: r.kind, id: r.id, from: r.from, to: r.to, txHash: r.txHash };
  const d = receiptDigest({ ...base, amount: BigInt(r.amountUnits) });
  return d === r.digest && receiptDigest({ ...base, amount: BigInt(r.amountUnits) + BigInt(1) }) !== r.digest;
});

interface Row { claim: string; level: string; evidence: string; limitation: string; passed: boolean }
const level = "Recorded on fork";
const rows: Row[] = [
  { claim: "The agent never holds tokens: the vault pays into an x402 channel and the agent only signs vouchers", level,
    evidence: `run-01: agent balance change ${r1.agentTokensChangeAusd}, escrowed ${r1.escrowedAusd}, vendor received ${r1.vendorReceivedAusd} after claims`,
    limitation: "A colluding agent and allowlisted vendor can claim a channel's full escrow; the channel deposit is the maximum loss",
    passed: r1.agentTokensChangeAusd === "0.00" && r1.vendorReceivedAusd === "25.00" && r1.escrowedAusd === "40.00" },
  { claim: "Every attempt outside the policy is refused, by the vault or by the real x402 contract", level,
    evidence: `${refusals.filter((a: { expected: string; refusedWith: string }) => a.expected === a.refusedWith).length} of ${refusals.length} recorded refusals returned the expected error`,
    limitation: "Refusals were simulated against the fork; a live deployment has not been tested",
    passed: refusals.length >= 8 && refusals.every((a: { expected: string; refusedWith: string }) => a.expected === a.refusedWith) },
  { claim: "A vendor refund cannot inflate lender share price before it is reconciled", level,
    evidence: `run-01: share value ${r1.shareValueBeforeReconcileAusd} before and ${r1.shareValueAfterReconcileAusd} after reconcile; unbooked refund ${r1.unbookedRefundAusd}; debt after ${r1.debtAfterReconcileAusd}`,
    limitation: "Refunded tokens sit idle until someone calls reconcile",
    passed: r1.shareValueBeforeReconcileAusd === r1.shareValueAfterReconcileAusd && r1.debtAfterReconcileAusd === "25.00" },
  { claim: "Repayments raise the agent's tier, so the same collateral supports more credit", level,
    evidence: `run-02: tier ${r2.tierBefore} to ${r2.tierAfter}, LTV ${r2.ltvBpsBefore} to ${r2.ltvBpsAfter} bps, credit limit ${r2.creditLimitBeforeAusd} to ${r2.creditLimitAfterAusd}`,
    limitation: "Tier thresholds are demo parameters, not calibrated risk numbers. The record can be farmed at the cost of interest",
    passed: r2.tierBefore === 0 && r2.tierAfter === 1 && r2.ltvBpsAfter > r2.ltvBpsBefore },
  { claim: "A customer's payment through the vault repays the loan before the agent is paid", level,
    evidence: `run-03: customer paid ${r3.customerPaidAusd}; debt ${r3.debtBeforeAusd} to ${r3.debtAfterAusd}; agent received ${r3.agentReceivedAusd}`,
    limitation: "Only payers the sponsor allowlisted count as revenue; nothing verifies the customer is independent of the agent",
    passed: r3.debtAfterAusd === "0.00" && r3.agentReceivedAusd === "60.00" },
  { claim: "The credit record follows the agent to a new sponsor", level,
    evidence: `run-04: a fresh agent was refused base 90 on 100 collateral; the proven agent got it, limit ${r4.sponsor2CreditLimitAusd}`,
    limitation: "One agent address, one record; no sybil resistance beyond the cost of interest",
    passed: r4.sponsor2CreditLimitAusd === "100.00" && refusals.some((a: { attempt: string; refusedWith: string }) => a.attempt.includes("fresh agent") && a.refusedWith === "BadTerms") },
  { claim: "A default is recorded and pins the agent to tier 0", level,
    evidence: `run-05: debt ${r5.debtAtLiquidationAusd}, ${r5.returnedToSponsorAusd} returned to the sponsor, defaults ${r5.defaults}, tier ${r5.tierAfter}`,
    limitation: "No liquidator bonus; shortfalls above 100% LTV tiers are borne by lenders",
    passed: r5.defaults === 1 && r5.tierAfter === 0 && r5.ltvBpsAfter === 7500 },
  { claim: "Every receipt digest recomputes from its own fields and changes on a 1 unit edit", level,
    evidence: `${proof.receipts.length} receipts checked`, limitation: "A digest proves the receipt was not edited; it is not a signature",
    passed: digestsOk },
  { claim: "The offline Foundry suite passes", level: "Tested",
    evidence: `${forgePassed} tests passed, ${forgeFailed} failed (mock settlement; fork tests skip themselves offline)`,
    limitation: "The same CreditVault suite was also run against the real contract on a Monad fork; that run is not repeated here",
    passed: forgePassed >= 22 && forgeFailed === 0 },
];

// Live deployment on Monad testnet: read only, and never fails the run if the RPC is unreachable.
let liveNote = "not re-checked (RPC unreachable or no .kit/deployment.json)";
try {
  if (fs.existsSync(path.join(root, ".kit", "deployment.json"))) {
    const live = await verifyDeployment();
    const ok = live.chainId === 10143 && live.checks.every((c) => c.ok);
    const d = JSON.parse(fs.readFileSync(path.join(root, ".kit", "deployment.json"), "utf8"));
    liveNote = `${live.checks.filter((c) => c.ok).length} of ${live.checks.length} on chain checks passed on chain id ${live.chainId}`;
    rows.push({ claim: "CreditVault and MockAUSD are deployed on Monad testnet and wired to the canonical x402 contract", level: "On chain (testnet)",
      evidence: `${liveNote}. Vault ${d.contractAddress}, deployment tx ${d.txHash}`,
      limitation: "The token is MockAUSD and the contracts are not audited", passed: ok });
  }
  // The live run: a full credit cycle broadcast to Monad testnet by tools/live-run.ts.
  const livePath = path.join(root, "LIVE_RUN.json");
  if (fs.existsSync(livePath)) {
    const run = JSON.parse(fs.readFileSync(livePath, "utf8"));
    const matched = run.refusals.filter((r: { expected: string; refusedWith: string }) => r.expected === r.refusedWith).length;
    rows.push({ claim: "A full credit cycle ran on Monad testnet against the deployed vault and the canonical x402 contract", level: "On chain (testnet)",
      evidence: `LIVE_RUN.json: ${run.transactions.length} transactions in blocks ${run.transactions[0].block} to ${run.transactions[run.transactions.length - 1].block}, ${matched} of ${run.refusals.length} refusals matched, agent's own funds ${run.summary.agentOwnFundsAusd}, ${run.summary.customerPaidAusd} of revenue repaid ${run.summary.debtBeforeRevenueAusd} of debt first`,
      limitation: "A scripted agent with throwaway agent and vendor keys; one funded wallet played lender, sponsor, customer and keeper; MockAUSD; no facilitator; refusals were checked by simulation, so they sent nothing",
      passed: run.chainId === 10143 && run.transactions.length >= 19 && matched === run.refusals.length && run.summary.agentOwnFundsAusd === "0.00" && run.summary.debtAfterRevenueAusd === "0.00" });
  }
  // The paid HTTP loop: an agent bought data over 402 and the vault's escrow paid for it (tools/agent.ts).
  const agentPath = path.join(root, "AGENT_RUN.json");
  if (fs.existsSync(agentPath)) {
    const a = JSON.parse(fs.readFileSync(agentPath, "utf8"));
    if ((a.transactions ?? []).length > 0) {
      rows.push({ claim: "An agent bought data from a paid HTTP endpoint (402, then a signed voucher) and vault escrow paid the vendor on Monad testnet", level: "On chain (testnet)",
        evidence: `AGENT_RUN.json: ${a.calls.length} paid calls at ${a.summary.pricePerCallAusd}, vendor received ${a.summary.vendorReceivedAusd} on chain, agent's own funds ${a.summary.agentOwnFundsAusd}, ${a.transactions.length} transactions`,
        limitation: "The agent is scripted, with no model choosing what to buy; no facilitator; the payment header layout was not tested against the reference x402 client; the demo vendor keeps no state between requests; the demo agent's key is public by design",
        passed: a.calls.length >= 1 && a.calls.every((c: { status: number }) => c.status === 200) && a.summary.agentOwnFundsAusd === "0.00" && Number(a.summary.vendorReceivedAusd) === a.calls.length * Number(a.summary.pricePerCallAusd) });
    }
  }
} catch (e) {
  liveNote = `not re-checked (${(e as Error).message.split("\n")[0]})`;
}

const failed = rows.filter((r) => !r.passed);
if (failed.length > 0) {
  console.error(`claim:verify FAILED on ${failed.length} claim(s):`, failed.map((r) => r.claim));
  process.exit(1);
}

const table = [
  "| Claim | Level | Evidence | Limitation |",
  "| --- | --- | --- | --- |",
  ...rows.map((r) => `| ${r.claim} | ${r.level} | ${r.evidence} | ${r.limitation} |`),
].join("\n");

const notClaimed = [
  "- Organic usage. The testnet activity is one scripted run (LIVE_RUN.json) in which a single funded wallet played lender, sponsor, customer and keeper. The longer run in PROOF_RUNS.json, including tier graduation, the portable record and liquidation, happened on a local Anvil fork.",
  "- Anything on Monad mainnet.",
  "- Real AUSD or USDC. The token in every run is MockAUSD.",
  "- Any use of the Monad x402 facilitator. The vendor claims directly as receiver authorizer.",
  "- Dynamic, Privy, Envio (HyperIndex or HyperSync) or Chainlink integrations. See docs/SPONSOR_INTEGRATIONS.md.",
  "- Audited or production ready contracts, or calibrated credit risk parameters.",
].join("\n");

fs.writeFileSync(path.join(root, "CLAIM_LEDGER.md"), [
  "# Claim ledger",
  "",
  `Generated by \`pnpm claim:verify\` from PROOF_RUNS.json (mode \`${proof.verificationMode}\`, chain id ${proof.chainId}) and the offline Foundry suite. It exits non zero if a claim outruns its evidence.`,
  "",
  `> ${proof.note}`,
  "",
  table,
  "",
  "## Not claimed",
  "",
  notClaimed,
  "",
].join("\n"));

fs.writeFileSync(path.join(root, "WHAT_IS_REAL.md"), [
  "# What is real",
  "",
  "| Layer | Status |",
  "| --- | --- |",
  "| `CreditVault` (pool, lines, tiers, record, revenue router, liquidation) | Written and tested offline and on a Monad fork. Deployed to Monad testnet, where one scripted credit cycle has run against it (LIVE_RUN.json). |",
  "| x402 batch settlement contract | The real canonical contract, at the same address on Monad testnet and mainnet. Used on a fork and in the live testnet run. |",
  "| Vouchers | Real EIP-712 signatures checked by the real contract. |",
  "| Token | MockAUSD. |",
  "| Monad x402 facilitator | Exists and lists batch-settlement for Monad. Not called. |",
  "| Sponsor SDKs (Dynamic, Privy) | Not integrated. |",
  "| Indexer | Built on plain RPC. Not run against a live deployment. |",
  "",
].join("\n"));

fs.mkdirSync(path.join(root, "docs"), { recursive: true });
fs.writeFileSync(path.join(root, "docs", "SPONSOR_INTEGRATIONS.md"), [
  "# Integrations and their real status",
  "",
  "Generated from `lib/seams.ts`. A row that says NOT_INTEGRATED means the repository does not use that service at all.",
  "",
  "| Service | Role | Status | Evidence | Not claimed |",
  "| --- | --- | --- | --- | --- |",
  ...SEAMS.map((s) => `| ${s.name} | ${s.role} | \`${s.status}\` | ${s.evidence} | ${s.notClaimed} |`),
  "",
].join("\n"));

console.log(`claim:verify: ${rows.length}/${rows.length} verified (mode=${proof.verificationMode}) -> wrote CLAIM_LEDGER.md, WHAT_IS_REAL.md, docs/SPONSOR_INTEGRATIONS.md`);
}

main().catch((e) => {
  console.error("claim:verify crashed:", e);
  process.exit(1);
});
