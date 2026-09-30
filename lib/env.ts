// lib/env.ts — zod-validated environment.
//
// This threw at MODULE LOAD when DATABASE_URL was missing and DEMO_MODE was off. In
// Next that runs during `next build` page-data collection, so a scaffolded project with
// no database yet could not build at all, with an error naming /api/health.
//
// Two changes, matching templates/web2/lib/env.ts:
//   1. `DEMO_MODE` is a plain flag with no dependency, so anything that only needs to
//      know whether it is in demo mode never triggers validation.
//   2. The DATABASE_URL requirement is enforced when the database is actually opened.
import { z } from "zod";

const truthy = (v: string | undefined) => v === "1" || v?.toLowerCase() === "true";

/** Whether DEMO_MODE is on. Safe to call at module scope — no validation, no throw. */
export function demoModeEnabled(): boolean {
  return truthy(process.env.DEMO_MODE);
}

const schema = z.object({
  DEMO_MODE: z
    .string()
    .optional()
    .default("0")
    .transform(truthy),
  DATABASE_URL: z.string().optional(),
  DEPLOY_URL: z.string().optional().default("http://localhost:3000"),
  // Chain read access (indexer + wagmi transport). Empty string means "let viem/wagmi use
  // their own public default RPC" — fine for local dev, never for a real indexing run.
  RPC_URL: z.string().optional().default(""),
  CONTRACT_ADDRESS: z.string().optional().default("0x0000000000000000000000000000000000000000"),
  START_BLOCK: z.string().optional().default("0"),
  CHAIN_ID: z.string().optional().default("10143"),
  // Required only by app/api/cron/catchup/route.ts — read there, not enforced at boot, so
  // the app still starts (e.g. DEMO_MODE, or before Vercel cron is configured) without it.
  CRON_SECRET: z.string().optional(),
});

function loadEnv() {
  const parsed = schema.safeParse({
    DEMO_MODE: process.env.DEMO_MODE,
    DATABASE_URL: process.env.DATABASE_URL,
    DEPLOY_URL: process.env.DEPLOY_URL,
    RPC_URL: process.env.RPC_URL,
    CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS,
    START_BLOCK: process.env.START_BLOCK,
    CHAIN_ID: process.env.CHAIN_ID,
    CRON_SECRET: process.env.CRON_SECRET,
  });
  if (!parsed.success) {
    console.error("lib/env.ts: invalid environment", parsed.error.flatten().fieldErrors);
    throw new Error("invalid environment — see lib/env.ts");
  }
  return parsed.data;
}

export const env = loadEnv();

/**
 * The database connection string, or a loud failure naming the real fix. Called at the
 * point of connection rather than at import time.
 */
export function requireDatabaseUrl(): string {
  if (!env.DATABASE_URL) {
    throw new Error(
      "lib/env.ts: DATABASE_URL is not set. Copy .env.example to .env and paste your " +
        "Postgres URL, or run with DEMO_MODE=1 to use the offline fixtures. " +
        "Free database: https://neon.tech",
    );
  }
  return env.DATABASE_URL;
}
