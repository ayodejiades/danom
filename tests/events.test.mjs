// tests/events.test.mjs — DEMO_MODE read path: fixtures are the real logs from `pnpm proof:local`.
import assert from "node:assert/strict";
import { test } from "node:test";

process.env.DEMO_MODE = "1";

test("listEvents serves the recorded credit vault receipts in DEMO_MODE", async () => {
  const { listEvents } = await import("../db/index.ts");
  const rows = await listEvents(50);
  const names = new Set(rows.map((r) => r.eventName));
  for (const n of ["LineOpened", "ChannelFunded", "Repaid", "RevenueRouted", "Liquidated", "ChannelReconciled"]) {
    assert.ok(names.has(n), `fixtures/events.json is missing a ${n} event — re-run pnpm proof:local`);
  }
  assert.equal(typeof rows[0].txHash, "string");
  assert.equal(typeof rows[0].blockNumber, "bigint");
});

test("listEvents orders newest block first", async () => {
  const { listEvents } = await import("../db/index.ts");
  const rows = await listEvents(50);
  for (let i = 1; i < rows.length; i++) {
    assert.ok(rows[i - 1].blockNumber >= rows[i].blockNumber);
  }
});
