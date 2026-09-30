// indexer/chain.ts — the viem public client the indexer reads through. Relative imports
// only: this file runs both standalone via `tsx` and inside Next.js API routes.
import { createPublicClient, http, type PublicClient } from "viem";
import { monad, monadTestnet, foundry } from "viem/chains";
import { env } from "../lib/env";

const CHAINS = { [monadTestnet.id]: monadTestnet, [monad.id]: monad, [foundry.id]: foundry } as const;

export function getChain() {
  return CHAINS[Number(env.CHAIN_ID) as keyof typeof CHAINS] ?? monadTestnet;
}

let client: PublicClient | null = null;

export function getPublicClient(): PublicClient {
  if (!client) {
    client = createPublicClient({
      chain: getChain(),
      transport: http(env.RPC_URL || undefined),
    });
  }
  return client;
}

export function cursorId(): string {
  return `${env.CHAIN_ID}:${env.CONTRACT_ADDRESS.toLowerCase()}`;
}
