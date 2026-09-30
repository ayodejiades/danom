import {
  createPublicClient,
  createWalletClient,
  http,
  getContract,
  type PublicClient,
  type WalletClient,
  type Address,
  type Chain
} from "viem";
import { baseSepolia, arbitrumSepolia } from "viem/chains";
import { AGENT_ESCROW_ABI, INTENT_SOLVER_ABI, PROOF_VERIFIER_ABI } from "./abi";

export * from "./abi";

export interface SdkConfig {
  contractAddress: Address;
  chain?: Chain;
  rpcUrl?: string;
  walletClient?: WalletClient;
}

/**
 * @class AgentEscrowClient
 * Programmatic client for autonomous AI agents settling SLA micro-payments and conditional escrows.
 */
export class AgentEscrowClient {
  public publicClient: any;
  public walletClient?: any;
  public address: Address;
  public contract: any;

  constructor(config: SdkConfig) {
    this.address = config.contractAddress;
    this.publicClient = createPublicClient({
      chain: config.chain || baseSepolia,
      transport: http(config.rpcUrl)
    });
    this.walletClient = config.walletClient;
    this.contract = getContract({
      address: this.address,
      abi: AGENT_ESCROW_ABI,
      client: {
        public: this.publicClient,
        wallet: this.walletClient
      }
    });
  }

  async getChannelCount(): Promise<bigint> {
    return (await this.publicClient.readContract({
      address: this.address,
      abi: AGENT_ESCROW_ABI,
      functionName: "nextChannelId"
    })) as bigint;
  }

  async getChannel(channelId: bigint) {
    const res = (await this.publicClient.readContract({
      address: this.address,
      abi: AGENT_ESCROW_ABI,
      functionName: "channels",
      args: [channelId]
    })) as [Address, Address, bigint, bigint, bigint, number];

    return {
      payer: res[0],
      provider: res[1],
      deposit: res[2],
      maxLatencyMs: res[3],
      deadline: res[4],
      status: ["ACTIVE", "SETTLED", "SLASHED", "REFUNDED"][res[5]]
    };
  }
}

/**
 * @class IntentSolverClient
 * Client for batching and executing intent-based order settlement cycles.
 */
export class IntentSolverClient {
  public publicClient: any;
  public address: Address;

  constructor(config: SdkConfig) {
    this.address = config.contractAddress;
    this.publicClient = createPublicClient({
      chain: config.chain || baseSepolia,
      transport: http(config.rpcUrl)
    });
  }

  async getNonce(account: Address): Promise<bigint> {
    return (await this.publicClient.readContract({
      address: this.address,
      abi: INTENT_SOLVER_ABI,
      functionName: "intentNonce",
      args: [account]
    })) as bigint;
  }

  async isIntentExecuted(intentHash: `0x${string}`): Promise<boolean> {
    return (await this.publicClient.readContract({
      address: this.address,
      abi: INTENT_SOLVER_ABI,
      functionName: "executedIntents",
      args: [intentHash]
    })) as boolean;
  }
}

/**
 * @class ProofVerifierClient
 * Client for on-chain verification of zkTLS notary attestations.
 */
export class ProofVerifierClient {
  public publicClient: any;
  public address: Address;

  constructor(config: SdkConfig) {
    this.address = config.contractAddress;
    this.publicClient = createPublicClient({
      chain: config.chain || baseSepolia,
      transport: http(config.rpcUrl)
    });
  }

  async getNotaryKey(): Promise<Address> {
    return (await this.publicClient.readContract({
      address: this.address,
      abi: PROOF_VERIFIER_ABI,
      functionName: "notaryKey"
    })) as Address;
  }

  async isVerified(commitmentHash: `0x${string}`): Promise<boolean> {
    return (await this.publicClient.readContract({
      address: this.address,
      abi: PROOF_VERIFIER_ABI,
      functionName: "verifiedHashes",
      args: [commitmentHash]
    })) as boolean;
  }
}
