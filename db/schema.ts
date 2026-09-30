// db/schema.ts — indexed on-chain events and the indexer's own resume cursor, migrated with
// drizzle-kit (see drizzle.config.ts).
import { bigint, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const indexedEvents = pgTable(
  "indexed_events",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    blockNumber: bigint("block_number", { mode: "bigint" }).notNull(),
    txHash: text("tx_hash").notNull(),
    logIndex: integer("log_index").notNull(),
    contractAddress: text("contract_address").notNull(),
    eventName: text("event_name").notNull(),
    args: jsonb("args").notNull(),
    blockTimestamp: timestamp("block_timestamp", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("indexed_events_tx_log_idx").on(table.txHash, table.logIndex),
    index("indexed_events_block_idx").on(table.blockNumber),
  ],
);

// One row per "chainId:contractAddress" — the indexer's resume point (§ indexer/cursor.ts).
export const indexerCursor = pgTable("indexer_cursor", {
  id: text("id").primaryKey(),
  lastIndexedBlock: bigint("last_indexed_block", { mode: "bigint" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type IndexedEvent = typeof indexedEvents.$inferSelect;
export type NewIndexedEvent = typeof indexedEvents.$inferInsert;
