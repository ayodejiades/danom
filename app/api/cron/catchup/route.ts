import { NextResponse } from "next/server";
import { runCatchup } from "@/indexer/catchup";
import { env } from "@/lib/env";

// Scheduled by vercel.json's `crons` entry. CRON_SECRET-gated so the endpoint can't be
// triggered by anyone who finds the URL — Vercel's own cron invoker sends this header
// automatically when CRON_SECRET is set as an env var (see docs/RPC.md step 5).
export async function GET(request: Request) {
  if (!env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const result = await runCatchup();
  return NextResponse.json({
    ok: true,
    inserted: result.inserted,
    fromBlock: result.fromBlock.toString(),
    toBlock: result.toBlock.toString(),
  });
}
