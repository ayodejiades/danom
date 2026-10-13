"use client";

import { useMemo, useState } from "react";
import { PageShell } from "@/components/page-shell";
import {
  creditLimit, checkFunding, debtAt, ltvBpsOf, pendingInterest, routeRevenue, splitRepayment, tierOf,
  type AgentRecord, type CreditLine, type FundRefusal,
} from "@/lib/credit";
import { fromUnits, toUnits } from "@/lib/stream";

const DAY = 86400;
const VENDOR = "0xAcMe000000000000000000000000000000000001";
const AGENT = "0xA6E4700000000000000000000000000000000002";
const UNKNOWN = "0x5717000000000000000000000000000000000003";

const RECEIVERS = [
  { id: VENDOR, key: "receiver-vendor", label: "Kestrel Search API (approved vendor)" },
  { id: AGENT, key: "receiver-self", label: "The agent's own wallet" },
  { id: UNKNOWN, key: "receiver-unknown", label: "An unknown wallet" },
];

const PLAIN: Record<FundRefusal, string> = {
  LineInactive: "The sponsor has revoked this line, so no new funding is possible.",
  LineExpired: "The line has expired.",
  ZeroAmount: "Enter an amount above zero.",
  ReceiverNotAllowed: "The sponsor never approved this wallet as a vendor, so the vault will not pay it.",
  OverPerBorrowCap: "That is above the per channel cap the sponsor set.",
  OverCreditLimit: "That would take total debt above the agent's current credit limit.",
  InsufficientCash: "The pool does not have that much idle cash.",
};

const INITIAL_LINE: CreditLine = {
  active: true, collateral: toUnits(400), baseLimit: toUnits(100), perBorrowCap: toUnits(40),
  principal: BigInt(0), interestOwed: BigInt(0), aprBps: 1000, repayShareBps: 5000,
  lastAccrual: 0, dueAt: 30 * DAY, allowedReceivers: [VENDOR],
};
const INITIAL_RECORD: AgentRecord = { repaidPrincipal: BigInt(0), revenueRouted: BigInt(0), defaults: 0 };
const POOL = toUnits(5000);

interface Row { id: number; day: number; action: string; ok: boolean; note: string }

function accrue(l: CreditLine, now: number): CreditLine {
  return { ...l, interestOwed: l.interestOwed + pendingInterest(l, now), lastAccrual: now };
}

export default function Demo() {
  const [now, setNow] = useState(0);
  const [line, setLine] = useState<CreditLine>(INITIAL_LINE);
  const [record, setRecord] = useState<AgentRecord>(INITIAL_RECORD);
  const [cash, setCash] = useState(POOL);
  const [receiver, setReceiver] = useState(VENDOR);
  const [amount, setAmount] = useState("30");
  const [revenue, setRevenue] = useState("100");
  const [rows, setRows] = useState<Row[]>([]);
  const [agentBalance, setAgentBalance] = useState(BigInt(0));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const debt = debtAt(line, now);
  const limit = creditLimit(line, record);
  const tier = tierOf(record);
  const ltv = ltvBpsOf(record);
  const nextTierAt = [100, 500, 2000][tier] ?? null;
  const day = Math.floor(now / DAY);

  const log = (action: string, ok: boolean, note: string) => {
    setRows((r) => [{ id: r.length + 1, day, action, ok, note }, ...r]);
    setMessage({ ok, text: note });
  };

  function fund() {
    const amt = toUnits(amount || "0");
    const verdict = checkFunding(line, record, receiver, amt, now, cash);
    const to = RECEIVERS.find((r) => r.id === receiver)?.label ?? receiver;
    if (!verdict.ok) return log(`Agent asks the vault to fund ${amount} for ${to}`, false, `Refused: ${verdict.reason}. ${PLAIN[verdict.reason]}`);
    setLine({ ...accrue(line, now), principal: line.principal + amt });
    setCash(cash - amt);
    log(`Agent asks the vault to fund ${amount} for ${to}`, true, `Funded. The vault escrowed ${fromUnits(amt)} in an x402 channel. The agent holds nothing; it signs vouchers.`);
  }

  function repay(all: boolean) {
    const a = accrue(line, now);
    const owed = a.principal + a.interestOwed;
    if (owed === BigInt(0)) return log("Sponsor repays", false, "Nothing is owed.");
    const pay = all ? owed : toUnits("10") < owed ? toUnits("10") : owed;
    const s = splitRepayment(a, pay, now);
    setLine({ ...a, interestOwed: s.interestLeft, principal: s.principalLeft });
    setCash(cash + s.interestPaid + s.principalPaid);
    setRecord({ ...record, repaidPrincipal: record.repaidPrincipal + s.principalPaid });
    log(`Sponsor repays ${fromUnits(pay)}`, true, `Interest ${fromUnits(s.interestPaid)} first, then principal ${fromUnits(s.principalPaid)}. Only principal counts toward the record.`);
  }

  function pay() {
    const amt = toUnits(revenue || "0");
    if (amt === BigInt(0)) return log("Customer pays the agent", false, PLAIN.ZeroAmount);
    const a = accrue(line, now);
    const r = routeRevenue(a, amt, now);
    setLine({ ...a, interestOwed: a.interestOwed - r.interestPaid, principal: a.principal - r.principalPaid });
    setCash(cash + r.toDebt);
    setAgentBalance(agentBalance + r.toAgent);
    setRecord({ ...record, repaidPrincipal: record.repaidPrincipal + r.principalPaid, revenueRouted: record.revenueRouted + amt });
    log(`Customer pays the agent ${revenue} through the vault`, true, `${fromUnits(r.toDebt)} went to the loan first. The agent received ${fromUnits(r.toAgent)}.`);
  }

  function revoke() {
    setLine({ ...line, active: !line.active });
    log(line.active ? "Sponsor revokes the line" : "Sponsor reopens the line", true, line.active ? "New funding stops at once. Escrow already committed returns after the channel's withdraw delay or a vendor refund." : "Funding is possible again.");
  }

  function advance(days: number) {
    setNow(now + days * DAY);
    log(`${days} days pass`, true, `Interest accrues per second. The line is due on day ${Math.floor(line.dueAt / DAY)}.`);
  }

  function reset() {
    setNow(0); setLine(INITIAL_LINE); setRecord(INITIAL_RECORD); setCash(POOL); setRows([]); setAgentBalance(BigInt(0)); setMessage(null);
  }

  const overdue = now > line.dueAt && debt > BigInt(0);
  const stats = useMemo(() => [
    { label: "Debt", value: fromUnits(debt), hint: `${fromUnits(line.principal)} principal + interest` },
    { label: "Credit limit", value: fromUnits(limit), hint: `base ${fromUnits(line.baseLimit)} + repaid, capped by collateral at ${ltv / 100}%` },
    { label: "Agent tier", value: String(tier), hint: nextTierAt ? `${nextTierAt} repaid reaches tier ${tier + 1}` : "top tier" },
    { label: "Repaid so far", value: fromUnits(record.repaidPrincipal), hint: `${fromUnits(record.revenueRouted)} revenue routed` },
    { label: "Agent wallet", value: fromUnits(agentBalance), hint: "only what customers paid it" },
    { label: "Pool idle cash", value: fromUnits(cash), hint: "collateral is never lent" },
  ], [debt, limit, tier, ltv, nextTierAt, record, agentBalance, cash, line]);

  const input = "w-full rounded-[var(--radius-sm)] border-[1.5px] border-[var(--line)] bg-[var(--paper)] px-3 py-2 font-mono text-base outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--sky)]";
  const primary = "btn btn-primary";
  const secondary = "btn btn-sm";
  const card = "rounded-[var(--radius)] border-[1.5px] border-[var(--line)] bg-[var(--paper)] p-6";
  const fieldLabel = "caption mb-2 block";

  return (
    <PageShell
      active="/demo"
      eyebrow="Simulation · the vault's rules in your browser"
      title={<>Try the credit <em>flow</em></>}
      intro={
        <p>
          This runs the vault&apos;s rules in your browser using the same functions the tests check against the contract. It is a simulation. The recorded run on the real x402 contract is on the <a className="link-rule font-semibold text-[var(--fg)]" href="/proof">recorded run</a> page.
        </p>
      }
    >
        <dl className="grid gap-px overflow-hidden rounded-[var(--radius)] border-[1.5px] border-[var(--fg)] bg-[var(--fg)] sm:grid-cols-2 lg:grid-cols-3" data-demo="list">
          {stats.map((s) => (
            <div key={s.label} className="bg-[var(--paper)] p-5">
              <dt className="caption">{s.label}</dt>
              <dd className="mt-2 font-[family-name:var(--font-display)] text-5xl leading-none tracking-tight">{s.value}</dd>
              <dd className="mt-2 text-xs text-[var(--fg-muted)] [text-wrap:pretty]">{s.hint}</dd>
            </div>
          ))}
        </dl>

        {overdue && <p className="rounded-[var(--radius-sm)] border-[1.5px] border-[var(--line)] bg-[var(--warn-bg)] px-4 py-3 text-sm">The line is overdue with debt outstanding. Anyone can now liquidate it, which would record a default and pin the agent to tier 0.</p>}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="flex flex-col gap-5">
            <section className={card}>
              <h2 className="mb-5 text-2xl">The agent asks the vault to pay a vendor</h2>
              <p className={fieldLabel} id="receiver-label">Who gets paid</p>
              <div role="radiogroup" aria-labelledby="receiver-label" className="mb-3 grid gap-2">
                {RECEIVERS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={receiver === r.id}
                    data-demo={r.key}
                    onClick={() => setReceiver(r.id)}
                    className={`rounded-[var(--radius-sm)] border-[1.5px] px-3 py-2 text-left text-sm font-medium transition-colors duration-200 ${receiver === r.id ? "border-[var(--fg)] bg-[var(--fg)] text-[var(--paper)]" : "border-[var(--border)] hover:border-[var(--fg)]"}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <label className={fieldLabel} htmlFor="amount">Channel amount (per channel cap is 40)</label>
              <input id="amount" data-demo="provider-input" className={`${input} mb-4`} value={amount} inputMode="decimal" onChange={(e) => setAmount(e.target.value)} />
              <button type="button" data-demo="trigger-escrow" className={primary} onClick={fund}>Ask the vault to fund the channel</button>
            </section>

            <section className={card}>
              <h2 className="mb-5 text-2xl">Money coming in</h2>
              <label className={fieldLabel} htmlFor="revenue">A customer pays the agent</label>
              <input id="revenue" className={`${input} mb-4`} value={revenue} inputMode="decimal" onChange={(e) => setRevenue(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                <button type="button" data-demo="route-revenue" className={secondary} onClick={pay}>Route the payment</button>
                <button type="button" className={secondary} onClick={() => repay(false)}>Sponsor repays 10</button>
                <button type="button" className={secondary} onClick={() => repay(true)}>Sponsor repays all</button>
              </div>
            </section>

            <section className={card}>
              <h2 className="mb-5 text-2xl">Sponsor and time</h2>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={secondary} onClick={revoke}>{line.active ? "Revoke the line" : "Reopen the line"}</button>
                <button type="button" className={secondary} onClick={() => advance(7)}>Advance 7 days</button>
                <button type="button" className={secondary} onClick={() => advance(31)}>Advance 31 days</button>
                <button type="button" className={secondary} onClick={reset}>Reset</button>
              </div>
            </section>
          </div>

          <section className="flex flex-col gap-4">
            <div aria-live="polite" className={`flex min-h-[5rem] items-center gap-5 rounded-[var(--radius)] border-[1.5px] px-5 py-4 text-sm [text-wrap:pretty] ${message ? (message.ok ? "border-[var(--ok)] bg-[var(--tint-ok)]" : "border-[var(--danger)] bg-[var(--tint-danger)]") : "border-dashed border-[var(--border)] text-[var(--fg-muted)]"}`}>
              {message ? <span key={rows.length} className={`stamp stamp-in shrink-0 text-sm ${message.ok ? "stamp-funded" : "stamp-refused"}`}>{message.ok ? "Allowed" : "Refused"}</span> : null}
              <p>{message ? message.text : "Pick a vendor and an amount, then ask the vault to fund the channel. Try the agent's own wallet or an amount above 40 to see a refusal."}</p>
            </div>
            <div className="overflow-hidden rounded-[var(--radius)] border-[1.5px] border-[var(--line)] bg-[var(--paper)]">
              <table className="w-full text-left text-sm">
                <thead className="border-b-[1.5px] border-[var(--line)]"><tr><th className="caption px-3 py-3 font-medium">Day</th><th className="caption px-3 py-3 font-medium">Action</th><th className="caption px-3 py-3 font-medium">Result</th></tr></thead>
                <tbody>
                  {rows.length === 0 && <tr><td colSpan={3} className="px-3 py-10 text-center text-[var(--fg-muted)]">The ledger is empty. Every action you take is entered here.</td></tr>}
                  {rows.map((r) => (
                    <tr key={r.id} data-demo="row" className="print-in border-t border-[var(--border)] align-top">
                      <td className="px-3 py-2 font-mono">{r.day}</td>
                      <td className="px-3 py-2">{r.action}</td>
                      <td className={`px-3 py-2 font-mono text-xs font-semibold uppercase tracking-wider ${r.ok ? "text-[var(--ok)]" : "text-[var(--danger)]"}`}>{r.ok ? "Allowed" : "Refused"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
    </PageShell>
  );
}
