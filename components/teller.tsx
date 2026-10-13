"use client";

import { useState } from "react";
import { checkFunding, creditLimit, type AgentRecord, type CreditLine, type FundRefusal } from "@/lib/credit";
import { fromUnits, toUnits } from "@/lib/stream";

const VENDOR = "0xAcMe000000000000000000000000000000000001";
const PAYEES = [
  { id: VENDOR, label: "Kestrel Search API", note: "approved vendor" },
  { id: "0xA6E4700000000000000000000000000000000002", label: "The agent's own wallet", note: "not approved" },
  { id: "0x5717000000000000000000000000000000000003", label: "An unknown wallet", note: "not approved" },
];
const AMOUNTS = ["30", "41"];

const WHY: Record<FundRefusal, string> = {
  LineInactive: "The sponsor revoked this line.",
  LineExpired: "The line has expired.",
  ZeroAmount: "The amount is zero.",
  ReceiverNotAllowed: "The sponsor never approved this wallet.",
  OverPerBorrowCap: "Above the 40.00 cap per channel.",
  OverCreditLimit: "Past the agent's 100.00 credit limit.",
  InsufficientCash: "The pool is out of idle cash.",
};

// Same opening terms as the credit flow page: 100 limit, 40 per channel, one approved vendor.
const LINE: CreditLine = {
  active: true, collateral: toUnits(400), baseLimit: toUnits(100), perBorrowCap: toUnits(40),
  principal: BigInt(0), interestOwed: BigInt(0), aprBps: 1000, repayShareBps: 5000,
  lastAccrual: 0, dueAt: 30 * 86400, allowedReceivers: [VENDOR],
};
const RECORD: AgentRecord = { repaidPrincipal: BigInt(0), revenueRouted: BigInt(0), defaults: 0 };

interface Entry { n: number; amount: string; to: string; reason: FundRefusal | null }

// A working teller window: each press runs the vault's own funding check (lib/credit.ts) and stamps the slip.
export function Teller() {
  const [payee, setPayee] = useState(PAYEES[1].id);
  const [amount, setAmount] = useState(AMOUNTS[0]);
  const [escrowed, setEscrowed] = useState(BigInt(0));
  const [entries, setEntries] = useState<Entry[]>([]);
  const last = entries[0];

  function ask() {
    const amt = toUnits(amount);
    const verdict = checkFunding({ ...LINE, principal: escrowed }, RECORD, payee, amt, 0, toUnits(5000));
    if (verdict.ok) setEscrowed(escrowed + amt);
    const to = PAYEES.find((p) => p.id === payee)?.label ?? payee;
    setEntries((e) => [{ n: e.length + 1, amount, to, reason: verdict.ok ? null : verdict.reason }, ...e]);
  }

  const chip = (on: boolean) =>
    `rounded-[var(--radius-sm)] border-[1.5px] px-3 py-2 text-left text-sm transition-colors duration-200 ${on ? "border-[var(--fg)] bg-[var(--fg)] text-[var(--paper)]" : "border-[var(--border)] hover:border-[var(--fg)]"}`;

  return (
    <div className="receipt relative flex w-full max-w-md flex-col gap-5 px-6 pb-10 pt-6 sm:px-7 lg:-rotate-1">
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-[family-name:var(--font-display)] text-2xl leading-none">Teller window</p>
        <p className="caption">Slip {String(entries.length + 1).padStart(3, "0")}</p>
      </div>
      <p className="caption dashed-rule pt-3">Limit {fromUnits(creditLimit(LINE, RECORD))} · cap {fromUnits(LINE.perBorrowCap)} per channel · 1 approved vendor</p>

      <fieldset className="flex flex-col gap-2">
        <legend className="caption mb-2">The agent asks the vault to pay</legend>
        {PAYEES.map((p) => (
          <button key={p.id} type="button" aria-pressed={payee === p.id} onClick={() => setPayee(p.id)} className={`flex items-center justify-between gap-3 ${chip(payee === p.id)}`}>
            <span className="font-medium">{p.label}</span>
            <span className="font-mono text-xs opacity-70">{p.note}</span>
          </button>
        ))}
      </fieldset>

      <div className="flex items-end justify-between gap-4">
        <fieldset className="flex gap-2">
          <legend className="caption mb-2">Amount</legend>
          {AMOUNTS.map((a) => (
            <button key={a} type="button" aria-pressed={amount === a} onClick={() => setAmount(a)} className={`font-mono ${chip(amount === a)}`}>{a}.00</button>
          ))}
        </fieldset>
        <button type="button" onClick={ask} className="btn btn-primary">Ask the vault</button>
      </div>

      <div aria-live="polite" className="dashed-rule flex min-h-[5.5rem] items-center gap-5 pt-4">
        {last ? (
          <>
            <span key={last.n} className={`stamp stamp-in shrink-0 text-lg ${last.reason ? "stamp-refused" : "stamp-funded"}`}>
              {last.reason ? "Refused" : "Funded"}
              <span className="text-[0.6rem] tracking-[0.08em]">{last.reason ?? "x402 channel"}</span>
            </span>
            <p className="text-sm text-[var(--fg-muted)]">
              {last.reason ? WHY[last.reason] : `The vault escrowed ${last.amount}.00 in a channel to ${last.to}. The agent signs vouchers against it.`}
            </p>
          </>
        ) : (
          <p className="text-sm text-[var(--fg-muted)]">Press the button. The slip is checked by the same rules the contract enforces, in the same order.</p>
        )}
      </div>

      {entries.length > 0 && (
        <ol className="flex flex-col gap-1 font-mono text-xs">
          {entries.slice(0, 4).map((e) => (
            <li key={e.n} className="print-in flex items-baseline justify-between gap-3">
              <span className="truncate text-[var(--fg-muted)]">{String(e.n).padStart(3, "0")} · {e.amount}.00 → {e.to}</span>
              <span className={`shrink-0 font-semibold ${e.reason ? "text-[var(--danger)]" : "text-[var(--ok)]"}`}>{e.reason ?? "Funded"}</span>
            </li>
          ))}
        </ol>
      )}

      <dl className="dashed-rule grid grid-cols-2 gap-4 pt-4">
        <div><dt className="caption">In channels</dt><dd className="font-mono text-2xl font-semibold">{fromUnits(escrowed)}</dd></div>
        <div className="text-right"><dt className="caption">Agent holds</dt><dd className="font-mono text-2xl font-semibold">0.00</dd></div>
      </dl>
    </div>
  );
}
