// app/api/health/route.ts — the deployment's own report on whether it actually works.
//
// This returned a hardcoded `{ ok: true }`, so `kit-autopilot`'s deploy/verify steps and
// `hack-preflight` check 6 reported success on an app whose indexer tables did not exist.
// It now really talks to the database. See templates/web2/app/api/health/route.ts for the
// same treatment and the same reasoning.
//
//   GET /api/health          shallow: process liveness, no I/O, for uptime pings
//   GET /api/health?deep=1   deep: opens the database and confirms the tables exist
import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo-mode";
import { probeDatabase } from "@/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const deep = new URL(request.url).searchParams.get("deep") === "1";
  const base = {
    ok: true,
    sha: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT ?? "dev",
    demoMode: isDemoMode(),
    checkedAt: new Date().toISOString(),
  };

  if (!deep) {
    return NextResponse.json(base, { headers: { "cache-control": "no-store" } });
  }

  const db = await probeDatabase();
  // In demo mode the fixtures are the product, so a healthy fixture store is `ok`.
  const ok = db.reachable && db.tablesPresent;

  return NextResponse.json(
    { ...base, ok, database: db },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
