// indexer/daemon.ts — long-lived process: run catchup once (in case it was down), then tail
// new blocks with watchContractEvent. Needs a host that stays running (not Vercel serverless
// — see docs/RPC.md step 5); SIGINT/SIGTERM stop it cleanly.
import { getPublicClient, cursorId } from "./chain";
import { ALL_EVENTS, serializeArgs } from "./abi";
import { runCatchup } from "./catchup";
import { insertEvents, setCursor } from "../db";
import { env } from "../lib/env";
import type { NewIndexedEvent } from "../db/schema";

export async function runDaemon(): Promise<void> {
  const caughtUp = await runCatchup();
  console.log(`indexer: catchup reached block ${caughtUp.toBlock} (${caughtUp.inserted} new row(s))`);

  const client = getPublicClient();
  const id = cursorId();

  const unwatch = client.watchContractEvent({
    address: env.CONTRACT_ADDRESS as `0x${string}`,
    abi: ALL_EVENTS,
    onLogs: async (logs) => {
      const rows: NewIndexedEvent[] = [];
      let maxBlock = BigInt(0);
      for (const log of logs) {
        const block = await client.getBlock({ blockNumber: log.blockNumber });
        rows.push({
          blockNumber: log.blockNumber,
          txHash: log.transactionHash,
          logIndex: log.logIndex,
          contractAddress: log.address,
          eventName: log.eventName as string,
          args: serializeArgs(log.args),
          blockTimestamp: new Date(Number(block.timestamp) * 1000),
        });
        if (log.blockNumber > maxBlock) maxBlock = log.blockNumber;
      }
      const inserted = await insertEvents(rows);
      if (rows.length > 0) {
        await setCursor(id, maxBlock);
        console.log(`indexer: tailed ${inserted} new row(s), cursor now at block ${maxBlock}`);
      }
    },
    onError: (error) => {
      console.error("indexer: watchContractEvent error", error);
    },
  });

  const stop = () => {
    unwatch();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  console.log("indexer: daemon tailing new blocks — Ctrl+C to stop");
}
