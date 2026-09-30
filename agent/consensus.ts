// agent/consensus.ts — Multi-agent state consensus & invariant verification engine.
// Formulates peer agent consensus before on-chain state execution.
import { type Hash, keccak256, toHex } from "viem";

export interface AgentVote {
  agentId: string;
  role: "SOLVER" | "AUDITOR" | "GUARDIAN";
  approved: boolean;
  signature: string;
  timestamp: number;
  invariantPassed: boolean;
}

export interface ConsensusProposal {
  proposalId: string;
  batchId: number;
  stateRoot: Hash;
  totalVolumeUsd: number;
  votes: AgentVote[];
  quorumReached: boolean;
  finalAttestationDigest?: Hash;
}

export function evaluateAgentConsensus(
  proposalId: string,
  batchId: number,
  stateRoot: Hash,
  totalVolumeUsd: number,
  votes: AgentVote[],
  requiredQuorum: number = 2
): ConsensusProposal {
  const approvingVotes = votes.filter((v) => v.approved && v.invariantPassed);
  const quorumReached = approvingVotes.length >= requiredQuorum;

  let finalAttestationDigest: Hash | undefined;
  if (quorumReached) {
    const rawDigestData = `${proposalId}:${batchId}:${stateRoot}:${totalVolumeUsd}:${approvingVotes.length}`;
    finalAttestationDigest = keccak256(toHex(rawDigestData));
  }

  return {
    proposalId,
    batchId,
    stateRoot,
    totalVolumeUsd,
    votes,
    quorumReached,
    finalAttestationDigest,
  };
}

export function createMockAgentVote(
  agentId: string,
  role: "SOLVER" | "AUDITOR" | "GUARDIAN",
  approved: boolean = true
): AgentVote {
  return {
    agentId,
    role,
    approved,
    signature: `0x${Math.random().toString(16).slice(2, 66).padEnd(64, "0")}`,
    timestamp: Date.now(),
    invariantPassed: approved,
  };
}
