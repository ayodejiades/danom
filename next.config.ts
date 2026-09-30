import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mirrors the server-only DEMO_MODE/RPC_URL into the client bundle under NEXT_PUBLIC_
  // names. lib/wagmi.ts runs in the browser (it's imported from a "use client" component
  // tree) and must never import lib/env.ts — that module throws when DATABASE_URL is unset
  // outside DEMO_MODE, a check that must only ever run on the server.
  env: {
    NEXT_PUBLIC_DEMO_MODE: process.env.DEMO_MODE ?? "0",
    NEXT_PUBLIC_RPC_URL: process.env.RPC_URL ?? "",
    NEXT_PUBLIC_MONAD_RPC: process.env.MONAD_RPC ?? "",
    NEXT_PUBLIC_CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS ?? "",
  },
};

export default nextConfig;
