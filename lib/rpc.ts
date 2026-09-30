// lib/rpc.ts — Multi-chain RPC connection helpers with deterministic fallbacks.
// Supports EVM (Base Sepolia, Somnia, Mantle, Berachain, Arbitrum), Solana, and Starknet.
import { createPublicClient, createWalletClient, http, fallback, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia, arbitrumSepolia } from "viem/chains";

// Custom L1/L2 testnet definitions
export const somniaTestnet = defineChain({
  id: 50312,
  name: "Somnia Testnet",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://dream-rpc.somnia.network"] },
    public: { http: ["https://dream-rpc.somnia.network"] },
  },
  blockExplorers: {
    default: { name: "Somnia Explorer", url: "https://somnia-testnet.socialscan.io" },
  },
  testnet: true,
});

export const mantleSepolia = defineChain({
  id: 5003,
  name: "Mantle Sepolia",
  nativeCurrency: { name: "MNT", symbol: "MNT", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.sepolia.mantle.xyz"] },
    public: { http: ["https://rpc.sepolia.mantle.xyz"] },
  },
  blockExplorers: {
    default: { name: "Mantle Sepolia Explorer", url: "https://sepolia.mantlescan.xyz" },
  },
  testnet: true,
});

export const berachainArtio = defineChain({
  id: 80084,
  name: "Berachain bArtio",
  nativeCurrency: { name: "BERA", symbol: "BERA", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://bartio.rpc.berachain.com"] },
    public: { http: ["https://bartio.rpc.berachain.com"] },
  },
  blockExplorers: {
    default: { name: "Berascan", url: "https://bartio.berascan.com" },
  },
  testnet: true,
});

export const SUPPORTED_CHAINS = {
  baseSepolia,
  somniaTestnet,
  mantleSepolia,
  berachainArtio,
  arbitrumSepolia,
} as const;

export type SupportedChainId = keyof typeof SUPPORTED_CHAINS;

export function getPublicClient(chainKey: SupportedChainId = "baseSepolia") {
  const targetChain = SUPPORTED_CHAINS[chainKey];
  return createPublicClient({
    chain: targetChain,
    transport: fallback([
      http(),
      http(targetChain.rpcUrls.default.http[0]),
    ]),
  });
}

export function getAgentWalletClient(privateKeyHex?: string, chainKey: SupportedChainId = "baseSepolia") {
  const pk = privateKeyHex || process.env.AGENT_PRIVATE_KEY || process.env.PRIVATE_KEY;
  if (!pk) {
    throw new Error("Missing AGENT_PRIVATE_KEY or PRIVATE_KEY in environment");
  }
  const formattedPk = pk.startsWith("0x") ? (pk as `0x${string}`) : (`0x${pk}` as `0x${string}`);
  const account = privateKeyToAccount(formattedPk);
  const targetChain = SUPPORTED_CHAINS[chainKey];

  return {
    account,
    walletClient: createWalletClient({
      account,
      chain: targetChain,
      transport: http(),
    }),
  };
}

export const SOLANA_DEVNET_RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
export const STARKNET_SEPOLIA_RPC = process.env.STARKNET_RPC_URL || "https://starknet-sepolia.public.blastapi.io/rpc/v0_7";
