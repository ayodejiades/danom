// agent/eliza_adapter.ts — ElizaOS (ai16z) runtime adapter for on-chain agent operations.
import { getPublicClient, getAgentWalletClient, type SupportedChainId } from "../lib/rpc";
import { executeAgentAutonomousCycle } from "./runner";

export interface ElizaRuntimeContext {
  agentId: string;
  chain: SupportedChainId;
  privateKey?: string;
  simulated?: boolean;
}

export interface ElizaActionPayload {
  actionName: "EXECUTE_SOLVER_CYCLE" | "VERIFY_INTENT" | "CHECK_ESCROW_BALANCE";
  params: Record<string, unknown>;
}

export interface ElizaActionResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export class ElizaAgentAdapter {
  private chain: SupportedChainId;
  private simulated: boolean;

  constructor(ctx: ElizaRuntimeContext) {
    this.chain = ctx.chain || "baseSepolia";
    this.simulated = ctx.simulated ?? true;
  }

  async handleAction(payload: ElizaActionPayload): Promise<ElizaActionResult> {
    switch (payload.actionName) {
      case "EXECUTE_SOLVER_CYCLE": {
        const cycleResult = await executeAgentAutonomousCycle(this.chain, this.simulated);
        return {
          success: cycleResult.consensusAchieved,
          data: {
            cycleId: cycleResult.cycleId,
            txHash: cycleResult.txHash,
            attestationDigest: cycleResult.attestationDigest,
            volumeUsd: cycleResult.totalVolumeUsd,
            savingsUsd: cycleResult.cowSavingsUsd,
          },
          error: cycleResult.error,
        };
      }
      case "CHECK_ESCROW_BALANCE": {
        const publicClient = getPublicClient(this.chain);
        const address = payload.params.address as `0x${string}` | undefined;
        if (!address) {
          return { success: false, error: "Missing address parameter" };
        }
        const balance = await publicClient.getBalance({ address });
        return {
          success: true,
          data: { address, balanceWei: balance.toString() },
        };
      }
      default:
        return { success: false, error: `Unsupported Eliza action: ${payload.actionName}` };
    }
  }
}
