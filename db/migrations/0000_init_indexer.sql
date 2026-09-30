CREATE TABLE "indexed_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "indexed_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"block_number" bigint NOT NULL,
	"tx_hash" text NOT NULL,
	"log_index" integer NOT NULL,
	"contract_address" text NOT NULL,
	"event_name" text NOT NULL,
	"args" jsonb NOT NULL,
	"block_timestamp" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "indexer_cursor" (
	"id" text PRIMARY KEY NOT NULL,
	"last_indexed_block" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "indexed_events_tx_log_idx" ON "indexed_events" USING btree ("tx_hash","log_index");--> statement-breakpoint
CREATE INDEX "indexed_events_block_idx" ON "indexed_events" USING btree ("block_number");