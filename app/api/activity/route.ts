// app/api/activity/route.ts — the vault's on chain history, read through Envio HyperSync.
// One query returns every log the vault has emitted since it was deployed; a public RPC would need
// thousands of ranged eth_getLogs calls for the same span. The per-agent credit record below is
// rebuilt from those events alone.
import { decodeEventLog, parseAbi, type Hex } from "viem";
import { NextResponse } from "next/server";
import { EXPLORER, VAULT } from "@/lib/x402";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const HYPERSYNC = "https://10143.hypersync.xyz/query";
const DEPLOY_BLOCK = 66_922_076;

const EVENTS = parseAbi([
  "event Supplied(address indexed lender, uint256 amount, uint256 shares)",
  "event LineOpened(address indexed sponsor, address indexed agent, uint256 collateral, uint256 baseLimit, uint256 perBorrowCap, uint256 aprBps, uint256 repayShareBps, uint64 dueAt)",
  "event VendorSet(address indexed sponsor, address indexed agent, address indexed receiver, address receiverAuthorizer)",
  "event RevenuePayerSet(address indexed sponsor, address indexed agent, address indexed payer, bool allowed)",
  "event ChannelFunded(address indexed sponsor, address indexed agent, address indexed receiver, bytes32 channelId, uint256 amount, uint256 debtAfter, uint256 limit)",
  "event ChannelReconciled(bytes32 indexed channelId, uint256 returnedNow, uint256 debtAfter)",
  "event Repaid(address indexed sponsor, address indexed agent, address indexed payer, uint256 interestPaid, uint256 principalPaid, uint256 debtAfter)",
  "event RevenueRouted(address indexed sponsor, address indexed agent, address indexed payer, uint256 amount, uint256 toDebt, uint256 toAgent)",
  "event LineRevoked(address indexed sponsor, address indexed agent)",
  "event CollateralReturned(address indexed sponsor, address indexed agent, uint256 amount)",
  "event Liquidated(address indexed sponsor, address indexed agent, address indexed liquidator, uint256 debt, uint256 seized, uint256 returnedToSponsor, uint256 shortfall)",
]);

interface RawLog { block_number: number; log_index: number; transaction_hash: Hex; topic0?: Hex; topic1?: Hex | null; topic2?: Hex | null; topic3?: Hex | null; data?: Hex }

const u = (n: unknown) => (Number(BigInt(String(n))) / 1e6).toFixed(2);
const short = (a: unknown) => `${String(a).slice(0, 6)}…${String(a).slice(-4)}`;

function describe(name: string, a: Record<string, unknown>): string {
  switch (name) {
    case "Supplied": return `lender ${short(a.lender)} supplied ${u(a.amount)}`;
    case "LineOpened": return `sponsor ${short(a.sponsor)} opened a line for agent ${short(a.agent)}: ${u(a.collateral)} collateral, ${u(a.baseLimit)} limit, ${u(a.perBorrowCap)} per channel`;
    case "VendorSet": return `sponsor approved vendor ${short(a.receiver)} for agent ${short(a.agent)}`;
    case "RevenuePayerSet": return `sponsor ${a.allowed ? "allowed" : "removed"} revenue payer ${short(a.payer)} for agent ${short(a.agent)}`;
    case "ChannelFunded": return `vault funded ${u(a.amount)} for agent ${short(a.agent)} to vendor ${short(a.receiver)}; debt ${u(a.debtAfter)} of ${u(a.limit)}`;
    case "ChannelReconciled": return `${u(a.returnedNow)} came back from a channel; debt ${u(a.debtAfter)}`;
    case "Repaid": return `${u(a.principalPaid)} principal and ${u(a.interestPaid)} interest repaid for agent ${short(a.agent)}; debt ${u(a.debtAfter)}`;
    case "RevenueRouted": return `${u(a.amount)} of revenue for agent ${short(a.agent)}: ${u(a.toDebt)} to the loan, ${u(a.toAgent)} to the agent`;
    case "LineRevoked": return `sponsor revoked agent ${short(a.agent)}'s line`;
    case "CollateralReturned": return `${u(a.amount)} collateral returned to sponsor ${short(a.sponsor)}`;
    case "Liquidated": return `agent ${short(a.agent)}'s line was liquidated: debt ${u(a.debt)}`;
    default: return name;
  }
}

export async function GET() {
  const token = process.env.ENVIO_API_TOKEN;
  if (!token) return NextResponse.json({ error: "No Envio API token is configured on this deployment." }, { status: 503 });
  try {
    const logs: RawLog[] = [];
    let from = DEPLOY_BLOCK;
    let height = 0;
    // HyperSync pages by block range: keep asking from next_block until it reaches the chain's height.
    for (let page = 0; page < 12; page++) {
      const r = await fetch(HYPERSYNC, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({
          from_block: from,
          logs: [{ address: [VAULT] }],
          field_selection: { log: ["block_number", "log_index", "transaction_hash", "topic0", "topic1", "topic2", "topic3", "data"] },
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!r.ok) throw new Error(`HyperSync answered ${r.status}: ${(await r.text()).slice(0, 160)}`);
      const j = (await r.json()) as { data?: { logs?: RawLog[] }[]; next_block: number; archive_height?: number };
      for (const batch of j.data ?? []) logs.push(...(batch.logs ?? []));
      height = j.archive_height ?? height;
      if (!j.next_block || j.next_block <= from || (height && j.next_block >= height)) break;
      from = j.next_block;
    }

    const records = new Map<string, { agent: string; funded: bigint; principalRepaid: bigint; revenueRouted: bigint; channels: number; defaults: number }>();
    const rec = (agent: unknown) => {
      const k = String(agent).toLowerCase();
      if (!records.has(k)) records.set(k, { agent: String(agent), funded: BigInt(0), principalRepaid: BigInt(0), revenueRouted: BigInt(0), channels: 0, defaults: 0 });
      return records.get(k)!;
    };
    const events = logs.flatMap((l) => {
      try {
        const topics = [l.topic0, l.topic1, l.topic2, l.topic3].filter((t): t is Hex => Boolean(t)) as [Hex, ...Hex[]];
        const d = decodeEventLog({ abi: EVENTS, topics, data: l.data ?? "0x" });
        const a = d.args as unknown as Record<string, unknown>;
        if (d.eventName === "ChannelFunded") { const r = rec(a.agent); r.funded += a.amount as bigint; r.channels += 1; }
        if (d.eventName === "Repaid") rec(a.agent).principalRepaid += a.principalPaid as bigint;
        if (d.eventName === "RevenueRouted") rec(a.agent).revenueRouted += a.amount as bigint;
        if (d.eventName === "Liquidated") rec(a.agent).defaults += 1;
        return [{ name: d.eventName, text: describe(d.eventName, a), block: l.block_number, tx: l.transaction_hash, explorer: `${EXPLORER}/tx/${l.transaction_hash}`, logIndex: l.log_index }];
      } catch {
        return [];
      }
    });
    events.sort((x, y) => y.block - x.block || y.logIndex - x.logIndex);

    return NextResponse.json({
      source: "Envio HyperSync (10143.hypersync.xyz)", fromBlock: DEPLOY_BLOCK, toBlock: height, totalEvents: events.length,
      agents: [...records.values()].map((r) => ({ agent: r.agent, channelsFunded: r.channels, funded: u(r.funded), principalRepaid: u(r.principalRepaid), revenueRouted: u(r.revenueRouted), defaults: r.defaults })),
      events: events.slice(0, 40),
    }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.split("\n")[0] }, { status: 502 });
  }
}
