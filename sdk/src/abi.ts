import { parseAbi } from "viem";

export const AGENT_ESCROW_ABI = parseAbi([
  "function nextChannelId() view returns (uint256)",
  "function channels(uint256) view returns (address payer, address provider, uint256 deposit, uint256 maxLatencyMs, uint256 deadline, uint8 status)",
  "function openChannel(address provider, uint256 maxLatencyMs, uint256 durationSeconds) payable returns (uint256 channelId)",
  "function settleWithSLA(uint256 channelId, uint256 latencyMs, bytes32 payloadHash, bytes signature)",
  "function slashBreach(uint256 channelId, uint256 latencyMs, bytes32 payloadHash, bytes signature)",
  "function claimExpired(uint256 channelId)",
  "event ChannelOpened(uint256 indexed channelId, address indexed payer, address indexed provider, uint256 deposit, uint256 maxLatencyMs, uint256 deadline)",
  "event ChannelSettled(uint256 indexed channelId, address indexed provider, uint256 payout, uint256 latencyMs)",
  "event ChannelSlashed(uint256 indexed channelId, address indexed payer, uint256 refund, uint256 latencyMs)",
  "event ChannelRefunded(uint256 indexed channelId, address indexed payer, uint256 refund)"
]);

export const INTENT_SOLVER_ABI = parseAbi([
  "function intentNonce(address) view returns (uint256)",
  "function executedIntents(bytes32) view returns (bool)",
  "function submitIntent((address sender, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint256 deadline, uint256 nonce) intent, bytes signature) returns (bytes32 intentHash)",
  "function settleCycle(bytes32 intentHashA, bytes32 intentHashB, address solverRewardRecipient)",
  "event IntentSubmitted(bytes32 indexed intentHash, address indexed sender, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint256 deadline)",
  "event CycleSettled(bytes32 indexed intentHashA, bytes32 indexed intentHashB, address indexed solver, uint256 volumeInA, uint256 volumeInB)"
]);

export const PROOF_VERIFIER_ABI = parseAbi([
  "function notaryKey() view returns (address)",
  "function verifiedHashes(bytes32) view returns (bool)",
  "function verifyWebProof(bytes32 commitmentHash, bytes32 claimDigest, uint256 timestamp, bytes signature) returns (bool)",
  "event ProofVerified(bytes32 indexed commitmentHash, bytes32 indexed claimDigest, address indexed submitter, uint256 timestamp)"
]);
