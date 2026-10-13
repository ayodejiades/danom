"use client";

import { useCallback, useEffect, useState } from "react";
import { privateKeyToAccount } from "viem/accounts";
import { PageShell } from "@/components/page-shell";
import {
  AGENT, AGENT_KEY, DEMO_CHANNEL, EXPLORER, PAYMENT_HEADER, paymentHeader, PRICE, units, VAULT, VENDOR, VOUCHER_DOMAIN, VOUCHER_TYPES,
} from "@/lib/x402";
import run from "@/AGENT_RUN.json";

interface Channel { channelId: `0x${string}`; escrow: string; totalClaimed: string; line: { active: boolean; perChannelCap: string; debt: string; creditLimit: string } }
interface Entry { id: number; request: string; status: string; ok: boolean; lines: string[] }
type RunTx = { step: string; hash: string; block: string; explorer: string };

const short = (a: string) => `${a.slice(0, 8)}…${a.slice(-6)}`;
const u = (s: string) => units(BigInt(s));

async function fetchChannel(): Promise<{ channel?: Channel; error?: string }> {
  try {
    const r = await fetch("/api/vendor/channel", { cache: "no-store" });
    const j = await r.json();
    return r.ok ? { channel: j as Channel } : { error: j.error ?? "unreachable" };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export default function AgentPage() {
  const [channel, setChannel] = useState<Channel | null>(null);
  const [channelError, setChannelError] = useState<string | null>(null);
  const [log, setLog] = useState<Entry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [paidCalls, setPaidCalls] = useState(0);
  const [showKey, setShowKey] = useState(false);

  const loadChannel = useCallback(async () => {
    const r = await fetchChannel();
    setChannel(r.channel ?? null);
    setChannelError(r.error ?? null);
    return r.channel ?? null;
  }, []);
  useEffect(() => {
    let live = true;
    fetchChannel().then((r) => { if (live) { setChannel(r.channel ?? null); setChannelError(r.error ?? null); } });
    return () => { live = false; };
  }, []);

  const add = (request: string, status: string, ok: boolean, lines: string[]) => setLog((l) => [{ id: l.length + 1, request, status, ok, lines }, ...l]);
  const guard = async (name: string, fn: () => Promise<void>) => {
    setBusy(name);
    try { await fn(); } catch (e) { add(name, "failed", false, [(e as Error).message]); } finally { setBusy(null); }
  };

  const unpaid = () => guard("GET /api/vendor/gas", async () => {
    const r = await fetch("/api/vendor/gas", { cache: "no-store" });
    const j = await r.json();
    const a = j.accepts?.[0];
    add("GET /api/vendor/gas", `${r.status} ${r.status === 402 ? "Payment Required" : ""}`, false, a
      ? [`price ${u(a.amount)} per call`, `scheme ${a.scheme} on ${a.network}`, `pay to ${a.payTo}`, `escrow contract ${a.extra.settlement}`]
      : [JSON.stringify(j)]);
  });

  const pay = () => guard("GET /api/vendor/gas + voucher", async () => {
    const ch = await loadChannel();
    if (!ch) throw new Error("Could not read the channel from Monad testnet");
    // Cumulative voucher: everything the vendor has claimed so far, plus one more call for each click in this visit.
    const max = BigInt(ch.totalClaimed) + PRICE * BigInt(paidCalls + 1);
    const signature = await privateKeyToAccount(AGENT_KEY).signTypedData({
      domain: VOUCHER_DOMAIN, types: VOUCHER_TYPES, primaryType: "Voucher", message: { channelId: ch.channelId, maxClaimableAmount: max },
    });
    const r = await fetch("/api/vendor/gas", { cache: "no-store", headers: { [PAYMENT_HEADER]: paymentHeader(DEMO_CHANNEL, max, signature) } });
    const j = await r.json();
    if (r.status === 200) {
      setPaidCalls((n) => n + 1);
      add(`GET /api/vendor/gas  ${PAYMENT_HEADER}: voucher for ${units(max)} total`, "200 OK", true, [
        `block ${j.data.blockNumber} at ${j.data.blockTime}`,
        `gas price ${j.data.gasPriceGwei} gwei, ${j.data.transactionsInBlock} transactions in the block`,
        `paid ${u(j.payment.price)} from vault escrow, ${u(j.payment.escrowLeft)} left in the channel`,
        `signature ${short(signature)}`,
      ]);
    } else {
      add(`GET /api/vendor/gas  ${PAYMENT_HEADER}: voucher for ${units(max)} total`, `${r.status} refused`, false, [j.error ?? JSON.stringify(j)]);
    }
  });

  const steal = (to: string, amount: number, label: string) => guard(label, async () => {
    const r = await fetch(`/api/vault/simulate?to=${to}&amount=${amount}`, { cache: "no-store" });
    const j = await r.json();
    add(`CreditVault.fundChannel(${label})`, j.allowed ? "would be funded" : `reverts: ${j.revertedWith}`, Boolean(j.allowed), [
      `asked by the agent key ${short(AGENT)}`, `receiver ${j.receiver}`, `amount ${Number(j.amount).toFixed(2)}`, "simulated against the live vault, nothing was sent",
    ]);
  });

  const txs = (run.transactions ?? []) as RunTx[];
  const card = "rounded-[var(--radius)] border-[1.5px] border-[var(--line)] bg-[var(--paper)] p-6";
  const stat = "bg-[var(--paper)] p-5";

  return (
    <PageShell
      active="/agent"
      eyebrow="Monad testnet · real HTTP 402 · real escrow"
      title={<>An agent that pays with <em>credit</em></>}
      intro={
        <p>
          This page calls a paid API. Unpaid, it answers 402. Paid with the agent&apos;s signed voucher, it answers with data, and the money comes out of escrow the vault put up. The agent&apos;s key is printed below. Take it.
        </p>
      }
    >
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <div className="flex flex-col gap-6">
          <div className={card}>
            <p className="caption mb-2">Step 1</p>
            <h2 className="mb-3 text-2xl">Ask without paying</h2>
            <p className="mb-5 text-sm text-[var(--fg-muted)]">The vendor sells a gas and block report for Monad testnet at {units(PRICE)} per call.</p>
            <button type="button" data-demo="x402-unpaid" className="btn" disabled={busy !== null} onClick={unpaid}>Call the API</button>
          </div>
          <div className={card}>
            <p className="caption mb-2">Step 2</p>
            <h2 className="mb-3 text-2xl">Pay with the agent&apos;s voucher</h2>
            <p className="mb-5 text-sm text-[var(--fg-muted)]">Your browser signs a voucher with the agent&apos;s key and retries. The vendor checks it against the x402 settlement contract on chain before it answers.</p>
            <button type="button" data-demo="x402-pay" className="btn btn-primary" disabled={busy !== null} onClick={pay}>Sign and pay</button>
          </div>
          <div className={card}>
            <p className="caption mb-2">Step 3</p>
            <h2 className="mb-3 text-2xl">Now try to steal it</h2>
            <p className="mb-5 text-sm text-[var(--fg-muted)]">You have the agent&apos;s key. Ask the live vault to send the money somewhere else.</p>
            <div className="flex flex-wrap gap-3">
              <button type="button" data-demo="x402-steal" className="btn btn-sm" disabled={busy !== null} onClick={() => steal("self", 10, "pay the agent's own wallet 10")}>Pay the agent itself</button>
              <button type="button" className="btn btn-sm" disabled={busy !== null} onClick={() => steal("0x000000000000000000000000000000000000dEaD", 10, "pay a stranger 10")}>Pay a stranger</button>
              <button type="button" data-demo="x402-cap" className="btn btn-sm" disabled={busy !== null} onClick={() => steal("vendor", 41, "pay the vendor 41")}>41 to the vendor</button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius)] border-[1.5px] border-[var(--line)] bg-[var(--line)]">
            <div className={stat}><dt className="caption">Vault money in the channel</dt><dd className="mt-2 font-[family-name:var(--font-display)] text-4xl leading-none">{channel ? u(channel.escrow) : "…"}</dd></div>
            <div className={stat}><dt className="caption">Agent&apos;s own stablecoin</dt><dd className="mt-2 font-[family-name:var(--font-display)] text-4xl leading-none">0.00</dd></div>
            <div className={stat}><dt className="caption">Vendor has claimed</dt><dd className="mt-2 font-mono text-xl">{channel ? u(channel.totalClaimed) : "…"}</dd></div>
            <div className={stat}><dt className="caption">Agent&apos;s debt / limit</dt><dd className="mt-2 font-mono text-xl">{channel ? `${u(channel.line.debt)} / ${u(channel.line.creditLimit)}` : "…"}</dd></div>
          </dl>
          {channelError && <p className="rounded-[var(--radius-sm)] border-[1.5px] border-[var(--line)] bg-[var(--warn-bg)] px-4 py-3 text-sm">Could not read Monad testnet just now: {channelError}</p>}
          {channel && !channel.line.active && <p className="rounded-[var(--radius-sm)] border-[1.5px] border-[var(--line)] bg-[var(--warn-bg)] px-4 py-3 text-sm">The sponsor has not opened this agent&apos;s line yet, so paid calls will be refused.</p>}

          <div data-demo="x402-log" aria-live="polite" className="flex min-h-[22rem] flex-col gap-3 rounded-[var(--radius)] border-[1.5px] border-[var(--line)] bg-[var(--navy)] p-5 font-mono text-xs">
            {log.length === 0 && <p className="text-[var(--fg-muted)]">The requests you make appear here, with the answers.</p>}
            {log.map((e) => (
              <div key={e.id} data-demo="x402-entry" className="print-in flex flex-col gap-1 border-b border-dashed border-[var(--border)] pb-3 last:border-b-0">
                <p className="break-all text-[var(--fg-muted)]">&gt; {e.request}</p>
                <p className={`text-sm font-semibold ${e.ok ? "text-[var(--ok)]" : "text-[var(--danger)]"}`}>{e.status}</p>
                {e.lines.map((l) => <p key={l} className="break-all">{l}</p>)}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <p className="caption">The agent&apos;s private key, published on purpose</p>
        <h2 className="max-w-3xl text-4xl">Leak the key. The money <em>stays</em>.</h2>
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className={`${card} flex flex-col gap-4`}>
            <p className="break-all font-mono text-sm">{showKey ? AGENT_KEY : `${AGENT_KEY.slice(0, 10)}${"•".repeat(40)}`}</p>
            <div><button type="button" className="btn btn-sm" onClick={() => setShowKey((s) => !s)}>{showKey ? "Hide the key" : "Show the key"}</button></div>
            <p className="text-sm text-[var(--fg-muted)]">Address <a className="link-rule font-mono" href={`${EXPLORER}/address/${AGENT}`} target="_blank" rel="noreferrer">{short(AGENT)}</a>. It holds a little MON for gas and no stablecoin.</p>
          </div>
          <ul className="flex flex-col gap-3 text-sm text-[var(--fg-muted)]">
            <li className="border-t border-[var(--border)] pt-3"><span className="font-semibold text-[var(--fg)]">What the key can do.</span> Sign vouchers, and ask the vault to fund a channel to the one vendor the sponsor approved, <span className="font-mono">{short(VENDOR)}</span>.</li>
            <li className="border-t border-[var(--border)] pt-3"><span className="font-semibold text-[var(--fg)]">What it cannot do.</span> Move the money anywhere else. The vault at <span className="font-mono">{short(VAULT)}</span> reverts, as step 3 shows.</li>
            <li className="border-t border-[var(--border)] pt-3"><span className="font-semibold text-[var(--fg)]">The most a thief can do.</span> Spend the credit line at that vendor, up to the limit, and burn the agent&apos;s gas. The sponsor revokes the line in one transaction.</li>
          </ul>
        </div>
      </section>

      {txs.length > 0 && (
        <section className="flex flex-col gap-4">
          <p className="caption">{run.generatedAt ? String(run.generatedAt).slice(0, 10) : ""} · tools/agent.ts</p>
          <h2 className="text-4xl">The same loop, run from a terminal</h2>
          <p className="max-w-3xl text-sm text-[var(--fg-muted)]">The agent got a 402, had the vault fund the channel, paid for {run.calls.length} calls with signed vouchers, and the vendor claimed and settled on chain.</p>
          <ol className="grid rounded-[var(--radius)] border-[1.5px] border-[var(--line)] bg-[var(--paper)] px-5 py-2 text-sm">
            {txs.map((t, i) => (
              <li key={t.hash} className="grid grid-cols-[2rem_1fr] items-baseline gap-x-3 gap-y-1 border-t border-dashed border-[var(--border)] py-2.5 first:border-t-0 md:grid-cols-[2rem_1fr_auto]">
                <span className="font-mono text-[var(--fg-muted)]">{String(i + 1).padStart(2, "0")}</span>
                <span>{t.step}</span>
                <a href={t.explorer} target="_blank" rel="noreferrer" className="link-rule font-mono text-xs text-[var(--accent-ink)] max-md:col-start-2">{short(t.hash)}</a>
              </li>
            ))}
          </ol>
        </section>
      )}

      <p className="max-w-3xl text-sm text-[var(--fg-muted)]">
        Limits: the agent here is scripted, the token is a test token and no x402 facilitator is involved. This demo vendor keeps no memory between requests, so it does not track the highest voucher it has seen; a production vendor does.
      </p>
    </PageShell>
  );
}
