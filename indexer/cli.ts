#!/usr/bin/env node
// indexer/cli.ts — `pnpm indexer:catchup` | `pnpm indexer:daemon` (see Makefile.fragment).
import { runCatchup } from "./catchup";
import { runDaemon } from "./daemon";

const USAGE = "Usage: tsx indexer/cli.ts <catchup|daemon>";
const mode = process.argv[2];

async function main() {
  if (mode === "catchup") {
    const result = await runCatchup();
    console.log(`indexer catchup: ${result.inserted} new row(s), cursor now at block ${result.toBlock}`);
    return;
  }
  if (mode === "daemon") {
    await runDaemon();
    return;
  }
  console.error(USAGE);
  process.exit(1);
}

main().catch((error) => {
  console.error("indexer: fatal error", error);
  process.exit(1);
});
