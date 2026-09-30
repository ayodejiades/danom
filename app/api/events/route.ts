import { NextResponse } from "next/server";
import { listEvents } from "@/db";

// Server-side only: the dashboard's read path never makes a client-side chain call, it
// reads the Postgres tables the indexer already populated (or the DEMO_MODE fixtures).
export async function GET() {
  const rows = await listEvents(50);
  return NextResponse.json({
    events: rows.map((row) => ({ ...row, blockNumber: row.blockNumber.toString() })),
  });
}
