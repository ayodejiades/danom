// indexer/catchup.ts — one-shot backfill: getLogs from the last indexed block (or
// START_BLOCK on a cold start) to the chain head, in bounded chunks so one call never times
// out a serverless function. Safe to run repeatedly: the cursor table plus the
// (tx_hash, log_index) unique index make every run idempotent.
import { getPublicClient, cursorId } from "./chain";
import { ALL_EVENTS, serializeArgs } from "./abi";
import { getCursor, setCursor, insertEvents } from "../db";
import { env } from "../lib/env";
import type { NewIndexedEvent } from "../db/schema";

// BigInt(n), not the `n` literal suffix — this project's tsconfig targets ES2017.
const CHUNK_SIZE = BigInt(2000);
const ONE = BigInt(1);

export type CatchupResult = { fromBlock: bigint; toBlock: bigint; inserted: number };

export async function runCatchup(): Promise<CatchupResult> {
  const client = getPublicClient();
  const id = cursorId();
  const latest = await client.getBlockNumber();
  const cursor = await getCursor(id);
  const startBlock = BigInt(env.START_BLOCK);
  const initialFrom = cursor !== null ? cursor + ONE : startBlock;

  if (initialFrom > latest) {
    return { fromBlock: initialFrom, toBlock: cursor ?? startBlock, inserted: 0 };
  }

  let inserted = 0;
  let cursorBlock = cursor ?? startBlock - ONE;
  let fromBlock = initialFrom;
  const blockTimestamps = new Map<bigint, bigint>();

  while (fromBlock <= latest) {
    const toBlock = fromBlock + CHUNK_SIZE - ONE > latest ? latest : fromBlock + CHUNK_SIZE - ONE;
    const logs = await client.getLogs({
      address: env.CONTRACT_ADDRESS as `0x${string}`,
      events: ALL_EVENTS,
      fromBlock,
      toBlock,
    });

    if (logs.length > 0) {
      const rows: NewIndexedEvent[] = [];
      for (const log of logs) {
        let ts = blockTimestamps.get(log.blockNumber);
        if (ts === undefined) {
          const block = await client.getBlock({ blockNumber: log.blockNumber });
          ts = block.timestamp;
          blockTimestamps.set(log.blockNumber, ts);
        }
        rows.push({
          blockNumber: log.blockNumber,
          txHash: log.transactionHash,
          logIndex: log.logIndex,
          contractAddress: log.address,
          eventName: log.eventName,
          args: serializeArgs(log.args),
          blockTimestamp: new Date(Number(ts) * 1000),
        });
      }
      inserted += await insertEvents(rows);
    }

    cursorBlock = toBlock;
    await setCursor(id, cursorBlock);
    fromBlock = toBlock + ONE;
  }

  return { fromBlock: initialFrom, toBlock: cursorBlock, inserted };
}
