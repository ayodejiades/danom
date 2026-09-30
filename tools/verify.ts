/**
 * Protocol Verification Suite for Web3 Projects.
 * Executed via: pnpm verify:flow or tsx tools/verify.ts
 *
 * Every check MUST actually execute the thing it claims to verify.
 * If a dependency is missing (e.g. no RPC, no Foundry), the check reports SKIP
 * with an honest reason — never a fake PASS.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  evaluatePolicyRules,
  solveComplementaryCycles,
  computeCanonicalDigest,
  DEMO_INTENTS,
  type SpendIntent,
  type PolicyConfig,
} from '../lib/solver.js';

interface CheckResult {
  id: string;
  name: string;
  category: 'SOLVER' | 'CONTRACT' | 'CRYPTO' | 'SECURITY';
  status: 'PASS' | 'FAIL' | 'SKIP';
  durationMs: number;
  details: string;
}

const checks: CheckResult[] = [];

function runCheck(
  id: string,
  name: string,
  category: CheckResult['category'],
  fn: () => {pass: boolean; skip?: boolean; details: string},
) {
  const start = performance.now();
  let status: CheckResult['status'] = 'FAIL';
  let details = '';
  try {
    const res = fn();
    status = res.skip ? 'SKIP' : res.pass ? 'PASS' : 'FAIL';
    details = res.details;
  } catch (err: unknown) {
    status = 'FAIL';
    details = err instanceof Error ? err.message : String(err);
  }
  const durationMs = Math.round((performance.now() - start) * 100) / 100;
  checks.push({id, name, category, status, durationMs, details});
}

console.log('================================================================================');
console.log('PROTOCOL VERIFICATION SUITE');
console.log('================================================================================');

// 1. Solver — actually run the policy engine
runCheck('CHECK-01', 'Policy engine evaluates valid intent as ALLOW', 'SOLVER', () => {
  if (DEMO_INTENTS.length === 0) {
    return {pass: false, skip: true, details: 'No DEMO_INTENTS defined in lib/solver.ts — populate them for your domain'};
  }
  // Build a minimal permissive policy to test the engine runs
  const testPolicy: PolicyConfig = {
    active: true, perCallCapUsd: 100000, dailyBudgetUsd: 1000000,
    settledSpendTodayUsd: 0, reservedAuthorityUsd: 0,
    minVendorLcbBps: 0, allowedCategories: ['rebalance', 'settlement', 'compute', 'liquidity'],
    allowedRecipients: ['0x0000000000000000000000000000000000000001' as `0x${string}`],
    allowedWorkers: ['0x0000000000000000000000000000000000000002' as `0x${string}`],
    cooldownSeconds: 0, lastServiceCallTimestamp: 0, callsInLastHour: 0,
    maxCallsPerHour: 1000, escalationThresholdUsd: 1000000,
    seenNonces: [], seenIntentKeys: [],
  };
  const testIntent: SpendIntent = {
    intentId: 'verify-test-1', requester: '0x0000000000000000000000000000000000000002',
    recipient: '0x0000000000000000000000000000000000000001',
    sellAsset: 'USDC', buyAsset: 'WETH', amountUsd: 100,
    maxSlippageBps: 50, maxLatencyMs: 1000, reportedLatencyMs: 10,
    category: 'rebalance', vendorLcbScoreBps: 9999,
    nonce: 1, timestamp: Math.floor(Date.now() / 1000),
    deadline: Math.floor(Date.now() / 1000) + 3600,
  };
  const result = evaluatePolicyRules(testIntent, testPolicy);
  return {
    pass: result.verdict === 'ALLOW',
    details: `Policy engine returned ${result.verdict} (${result.passedCount}/${result.totalRules} rules passed)`,
  };
});

runCheck('CHECK-02', 'Policy engine blocks replay nonce', 'SOLVER', () => {
  const policy: PolicyConfig = {
    active: true, perCallCapUsd: 100000, dailyBudgetUsd: 1000000,
    settledSpendTodayUsd: 0, reservedAuthorityUsd: 0, minVendorLcbBps: 0,
    allowedCategories: ['rebalance'], allowedRecipients: ['0x0000000000000000000000000000000000000001'],
    allowedWorkers: ['0x0000000000000000000000000000000000000002'],
    cooldownSeconds: 0, lastServiceCallTimestamp: 0, callsInLastHour: 0,
    maxCallsPerHour: 1000, escalationThresholdUsd: 1000000,
    seenNonces: [42], seenIntentKeys: [],
  };
  const intent: SpendIntent = {
    intentId: 'replay-test', requester: '0x0000000000000000000000000000000000000002',
    recipient: '0x0000000000000000000000000000000000000001',
    sellAsset: 'USDC', buyAsset: 'WETH', amountUsd: 100,
    maxSlippageBps: 50, maxLatencyMs: 1000, reportedLatencyMs: 10,
    category: 'rebalance', vendorLcbScoreBps: 9999,
    nonce: 42, timestamp: Math.floor(Date.now() / 1000),
    deadline: Math.floor(Date.now() / 1000) + 3600,
  };
  const result = evaluatePolicyRules(intent, policy);
  return {
    pass: result.verdict === 'BLOCK',
    details: result.verdict === 'BLOCK'
      ? 'Replay nonce correctly blocked'
      : `Expected BLOCK but got ${result.verdict}`,
  };
});

// 2. Cycle solver
runCheck('CHECK-03', 'Cycle solver finds complementary ring', 'SOLVER', () => {
  const result = solveComplementaryCycles([
    {wallet: 'A', sellAsset: 'X', buyAsset: 'Y', amountUsd: 100},
    {wallet: 'B', sellAsset: 'Y', buyAsset: 'Z', amountUsd: 100},
    {wallet: 'C', sellAsset: 'Z', buyAsset: 'X', amountUsd: 100},
  ]);
  return {
    pass: result.cycleLength === 3 && result.crossedUsd > 0,
    details: `Crossed $${result.crossedUsd.toFixed(2)} in ${result.cycleLength}-way cycle (${result.efficiencyBps} bps efficiency)`,
  };
});

// 3. Digest integrity
runCheck('CHECK-04', 'EIP-712 digest changes on 1-cent mutation', 'CRYPTO', () => {
  const base: SpendIntent = {
    intentId: 'digest-test', requester: '0x0000000000000000000000000000000000000001',
    recipient: '0x0000000000000000000000000000000000000002',
    sellAsset: 'USDC', buyAsset: 'WETH', amountUsd: 100,
    maxSlippageBps: 50, maxLatencyMs: 1000, reportedLatencyMs: 10,
    category: 'rebalance', vendorLcbScoreBps: 9999, nonce: 1,
    timestamp: 1700000000, deadline: 1700003600,
  };
  const d1 = computeCanonicalDigest(base);
  const d2 = computeCanonicalDigest({...base, amountUsd: 100.01});
  return {
    pass: d1 !== d2 && d1.startsWith('0x') && d1.length === 66,
    details: d1 !== d2
      ? `Mutation sensitivity verified (${d1.slice(0, 14)}… ≠ ${d2.slice(0, 14)}…)`
      : 'CRITICAL: digest did not change on amount mutation',
  };
});

// 4. Foundry contracts exist
runCheck('CHECK-05', 'Solidity contract sources present', 'CONTRACT', () => {
  const contractsDir = path.join(process.cwd(), 'contracts', 'src');
  if (!fs.existsSync(contractsDir)) {
    return {pass: false, skip: true, details: 'contracts/src/ directory not found'};
  }
  const sols = fs.readdirSync(contractsDir).filter((f) => f.endsWith('.sol'));
  return {
    pass: sols.length > 0,
    details: `${sols.length} Solidity source(s): ${sols.join(', ')}`,
  };
});

runCheck('CHECK-06', 'Foundry test sources present', 'CONTRACT', () => {
  const testsDir = path.join(process.cwd(), 'contracts', 'test');
  if (!fs.existsSync(testsDir)) {
    return {pass: false, skip: true, details: 'contracts/test/ directory not found'};
  }
  const tests = fs.readdirSync(testsDir).filter((f) => f.endsWith('.sol'));
  return {
    pass: tests.length > 0,
    details: `${tests.length} Foundry test(s): ${tests.join(', ')}`,
  };
});

// 5. PROOF_RUNS.json populated
runCheck('CHECK-07', 'PROOF_RUNS.json has idea-specific runs', 'SECURITY', () => {
  const proofPath = path.join(process.cwd(), 'PROOF_RUNS.json');
  if (!fs.existsSync(proofPath)) {
    return {pass: false, details: 'PROOF_RUNS.json not found'};
  }
  const proof = JSON.parse(fs.readFileSync(proofPath, 'utf8'));
  if (!Array.isArray(proof.runs) || proof.runs.length === 0) {
    return {pass: false, details: 'PROOF_RUNS.json has empty runs[] — populate with domain-specific proof runs'};
  }
  // Check for stolen @winsznx data
  const raw = fs.readFileSync(proofPath, 'utf8');
  const stolen = ['0x8b607937', '0x10053A14', 'NVDAx', 'SPYx', 'BOT Chain', 'Robinhood Chain'];
  const found = stolen.filter((s) => raw.includes(s));
  if (found.length > 0) {
    return {pass: false, details: `PROOF_RUNS.json contains stolen project data: ${found.join(', ')}`};
  }
  return {pass: true, details: `${proof.runs.length} proof run(s) present, no stolen data detected`};
});

// Report
console.log('');
console.log('ID        | CATEGORY | STATUS | TIME     | DETAILS');
console.log('--------------------------------------------------------------------------------');
let failures = 0;
let skips = 0;
for (const c of checks) {
  if (c.status === 'FAIL') failures++;
  if (c.status === 'SKIP') skips++;
  const timeStr = `${c.durationMs.toFixed(2)}ms`.padEnd(8);
  const statusTag = c.status === 'PASS' ? '[PASS]' : c.status === 'SKIP' ? '[SKIP]' : '[FAIL]';
  console.log(`${c.id.padEnd(9)} | ${c.category.padEnd(8)} | ${statusTag} | ${timeStr} | ${c.name}: ${c.details}`);
}
console.log('--------------------------------------------------------------------------------');
console.log(`TOTAL: ${checks.length} checks (${checks.length - failures - skips} passed, ${skips} skipped, ${failures} failed)`);
if (failures > 0) {
  console.log('RESULT: FAILURES DETECTED [ERROR]');
  process.exit(1);
} else {
  console.log('RESULT: ALL CHECKS PASSED OR HONESTLY SKIPPED [OK]');
}
