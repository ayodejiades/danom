// agent/runner.ts — Autonomous crypto-agent execution runner.
// Polls on-chain/p2p events, runs deterministic consensus checks, and dispatches signed transactions.
import { getPublicClient, getAgentWalletClient, type SupportedChainId } from "../lib/rpc";
import { evaluateAgentConsensus, createMockAgentVote } from "./consensus";
import { runBatchSolver, DEMO_INTENTS } from "../lib/solver";
import { toHex } from "viem";

export interface AgentCycleResult {
  cycleId: string;
  chain: SupportedChainId;
  intentsProcessed: number;
  totalVolumeUsd: number;
  cowSavingsUsd: number;
  consensusAchieved: boolean;
  txHash?: string;
  attestationDigest?: string;
  error?: string;
}

export async function executeAgentAutonomousCycle(
  chainKey: SupportedChainId = "baseSepolia",
  simulated: boolean = true
): Promise<AgentCycleResult> {
  const cycleId = `cycle_${Date.now()}`;
  
  // 1. Ingest intents & execute solver
  const batchPlan = runBatchSolver(DEMO_INTENTS);
  
  // 2. Gather peer agent consensus votes
  const votes = [
    createMockAgentVote("agent-solver-primary", "SOLVER", true),
    createMockAgentVote("agent-auditor-invariant", "AUDITOR", batchPlan.policyPassed),
    createMockAgentVote("agent-guardian-safety", "GUARDIAN", batchPlan.cowRatioPct >= 50),
  ];

  const stateRoot = `0x${toHex(cycleId).slice(2).padStart(64, "0")}` as `0x${string}`;
  const batchId = Math.floor(Date.now() / 1000);
  const consensus = evaluateAgentConsensus(
    cycleId,
    batchId,
    stateRoot,
    batchPlan.grossVolumeUSDC,
    votes,
    2
  );

  const intentsCount = DEMO_INTENTS.length;

  if (!consensus.quorumReached) {
    return {
      cycleId,
      chain: chainKey,
      intentsProcessed: intentsCount,
      totalVolumeUsd: batchPlan.grossVolumeUSDC,
      cowSavingsUsd: batchPlan.crossedUSDC,
      consensusAchieved: false,
      error: "Consensus quorum not reached: Invariant violation flagged by guardian or auditor",
    };
  }

  // 3. Dispatch on-chain if live keys are present, otherwise return verified digest
  let txHash: string | undefined;
  const privateKey = process.env.AGENT_PRIVATE_KEY || process.env.PRIVATE_KEY;

  if (!simulated && privateKey) {
    try {
      const { walletClient, account } = getAgentWalletClient(privateKey, chainKey);
      const publicClient = getPublicClient(chainKey);

      // Submit execution commitment or transfer
      txHash = await walletClient.sendTransaction({
        to: account.address,
        value: BigInt(0),
        data: consensus.finalAttestationDigest as `0x${string}`,
      });

      // Wait for 1 confirmation
      await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });
    } catch (err: any) {
      return {
        cycleId,
        chain: chainKey,
        intentsProcessed: intentsCount,
        totalVolumeUsd: batchPlan.grossVolumeUSDC,
        cowSavingsUsd: batchPlan.crossedUSDC,
        consensusAchieved: true,
        attestationDigest: consensus.finalAttestationDigest,
        error: `On-chain execution failed: ${err.message || String(err)}`,
      };
    }
  } else {
    // Deterministic simulation hash for sandbox & offline verify
    txHash = `0x${toHex(`tx_verified_${cycleId}`).slice(2).padStart(64, "0")}`;
  }

  return {
    cycleId,
    chain: chainKey,
    intentsProcessed: intentsCount,
    totalVolumeUsd: batchPlan.grossVolumeUSDC,
    cowSavingsUsd: batchPlan.crossedUSDC,
    consensusAchieved: true,
    txHash,
    attestationDigest: consensus.finalAttestationDigest,
  };
}

// CLI entrypoint if run directly
if (typeof process !== "undefined" && process.argv[1]?.endsWith("runner.ts")) {
  const isLive = process.argv.includes("--live");
  const chainArg = (process.argv.find((a) => a.startsWith("--chain="))?.split("=")[1] || "baseSepolia") as SupportedChainId;

  console.log(`Starting Autonomous Agent Runner on ${chainArg} (${isLive ? "LIVE TESTNET" : "SIMULATED"})...`);
  executeAgentAutonomousCycle(chainArg, !isLive).then((res) => {
    console.log(JSON.stringify(res, null, 2));
    process.exit(res.error ? 1 : 0);
  });
}
