// db/index.ts — reads DATABASE_URL. In DEMO_MODE, reads an in-memory store seeded from
// fixtures/ instead, so the dashboard's read path works with the Wi-Fi off. The indexer
// (insertEvents/getCursor/setCursor) never runs under DEMO_MODE — there is no chain to read.
//
// Relative imports only (not the `@/` alias): this module is imported both by Next.js app
// code and by indexer/*.ts scripts run directly via `tsx`, which does not resolve tsconfig
// path aliases (same convention as tests/*.test.mjs).
import fs from "node:fs";
import path from "node:path";
import { desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { isDemoMode } from "../lib/demo-mode";
import { requireDatabaseUrl } from "../lib/env";
import { indexedEvents, indexerCursor, type IndexedEvent, type NewIndexedEvent } from "./schema";

type FixtureRow = {
  blockNumber: string;
  txHash: string;
  logIndex: number;
  contractAddress: string;
  eventName: string;
  args: Record<string, unknown>;
  blockTimestamp: string;
};

let memoryStore: IndexedEvent[] | null = null;

function loadFixtureStore(): IndexedEvent[] {
  const fixturePath = path.join(process.cwd(), "fixtures", "events.json");
  const seed: FixtureRow[] = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));
  return seed.map((row, i) => ({
    id: i + 1,
    blockNumber: BigInt(row.blockNumber),
    txHash: row.txHash,
    logIndex: row.logIndex,
    contractAddress: row.contractAddress,
    eventName: row.eventName,
    args: row.args,
    blockTimestamp: new Date(row.blockTimestamp),
  }));
}

function getMemoryStore(): IndexedEvent[] {
  if (!memoryStore) memoryStore = loadFixtureStore();
  return memoryStore;
}

let sqlClient: ReturnType<typeof postgres> | null = null;
function getDrizzle() {
  if (!sqlClient) {
    sqlClient = postgres(requireDatabaseUrl(), { max: 5 });
  }
  return drizzle(sqlClient);
}

/**
 * probeDatabase — the deep check behind /api/health.
 *
 * DEMO_MODE=1: reports the fixture store without touching a database, since demo mode is
 * designed to work with the Wi-Fi off.
 * DEMO_MODE=0: connects, runs `SELECT 1`, and confirms the tables the indexer writes
 * actually exist. An empty db/migrations/ used to mean every dashboard route 500'd, and
 * the health endpoint reported `ok: true` regardless.
 */
export async function probeDatabase(): Promise<{
  reachable: boolean;
  tablesPresent: boolean;
  detail: string;
  latencyMs: number;
}> {
  if (isDemoMode()) {
    return {
      reachable: true,
      tablesPresent: true,
      detail: `demo mode — ${getMemoryStore().length} fixture events, no database contacted`,
      latencyMs: 0,
    };
  }

  const started = Date.now();
  // requireDatabaseUrl() throws when DATABASE_URL is unset, so it is called inside a
  // try: a missing URL is a health finding to report, not a 500 on the health route.
  let client: ReturnType<typeof postgres>;
  try {
    client = postgres(requireDatabaseUrl(), { max: 1, connect_timeout: 5 });
  } catch (err) {
    return {
      reachable: false,
      tablesPresent: false,
      detail: (err as Error).message,
      latencyMs: Date.now() - started,
    };
  }

  try {
    await client`SELECT 1`;
    // to_regclass returns NULL rather than erroring when a table is absent, so a missing
    // migration surfaces as a clear message instead of "relation does not exist".
    const rows = await client<{ present: number | null }[]>`
      SELECT
        to_regclass('public.indexed_events') IS NOT NULL
        AND to_regclass('public.indexer_cursor') IS NOT NULL AS present
    `;
    const present = rows[0]?.present === 1;
    return {
      reachable: true,
      tablesPresent: present,
      detail: present
        ? "connected; tables 'indexed_events' and 'indexer_cursor' present"
        : "connected but 'indexed_events'/'indexer_cursor' are missing — run `pnpm db:migrate` against this database",
      latencyMs: Date.now() - started,
    };
  } catch (err) {
    return {
      reachable: false,
      tablesPresent: false,
      detail: (err as Error).message,
      latencyMs: Date.now() - started,
    };
  } finally {
    await client.end({ timeout: 2 }).catch(() => {});
  }
}

export async function listEvents(limit = 50): Promise<IndexedEvent[]> {
  if (isDemoMode()) {
    return [...getMemoryStore()]
      .sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber))
      .slice(0, limit);
  }
  const db = getDrizzle();
  return db.select().from(indexedEvents).orderBy(desc(indexedEvents.blockNumber)).limit(limit);
}

// Used only by the indexer. Idempotent: re-inserting a (txHash, logIndex) pair is a no-op,
// so a catchup range can safely overlap the last run.
export async function insertEvents(rows: NewIndexedEvent[]): Promise<number> {
  if (rows.length === 0) return 0;
  const db = getDrizzle();
  const inserted = await db
    .insert(indexedEvents)
    .values(rows)
    .onConflictDoNothing({ target: [indexedEvents.txHash, indexedEvents.logIndex] })
    .returning({ id: indexedEvents.id });
  return inserted.length;
}

export async function getCursor(id: string): Promise<bigint | null> {
  const db = getDrizzle();
  const [row] = await db.select().from(indexerCursor).where(eq(indexerCursor.id, id));
  return row ? row.lastIndexedBlock : null;
}

export async function setCursor(id: string, block: bigint): Promise<void> {
  const db = getDrizzle();
  await db
    .insert(indexerCursor)
    .values({ id, lastIndexedBlock: block })
    .onConflictDoUpdate({
      target: indexerCursor.id,
      set: { lastIndexedBlock: block, updatedAt: sql`now()` },
    });
}
