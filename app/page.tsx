import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/page-shell";
import { Teller } from "@/components/teller";
import proof from "@/PROOF_RUNS.json";

type Refusal = { attempt: string; expected: string; refusedWith: string };
const run = <T,>(id: string) => proof.runs.find((r) => r.id === id) as unknown as T;

const STEPS = [
  { n: "1", who: "Lender", title: "A lender funds the vault", body: "Lenders supply stablecoin to one shared pool and earn the interest borrowers pay." },
  { n: "2", who: "Sponsor", title: "A sponsor sets the leash", body: "A person or a DAO locks collateral and names the vendors the agent may pay, a cap per channel, a credit ceiling and an expiry." },
  { n: "3", who: "Agent", title: "The vault pays, the agent signs", body: "The vault opens x402 payment channels to approved vendors. The agent holds only a voucher signing key. It never holds the money." },
  { n: "4", who: "Customer", title: "Revenue repays first", body: "Customers pay the agent through the vault. A share goes to the loan before the agent sees the rest." },
];

const TIERS = [
  { tier: "0", repaid: "under 100", ltv: 75, note: "New agent. Credit is less than the collateral." },
  { tier: "1", repaid: "100 or more", ltv: 100, note: "First tier a record buys." },
  { tier: "2", repaid: "500 or more", ltv: 150, note: "Undercollateralized. Lenders carry the gap." },
  { tier: "3", repaid: "2,000 or more", ltv: 250, note: "Any default drops the agent back to tier 0." },
];

const FAQ = [
  { q: "Can the agent run off with the money?", a: "No. The agent holds a voucher signing key and nothing else. The vault escrows funds in x402 channels to vendors the sponsor approved. One limit remains: an agent and an approved vendor that collude can claim a channel's full escrow, so the channel deposit is the most that can be lost." },
  { q: "What happens if the agent does not repay?", a: "Once a line is overdue with debt outstanding, anyone can liquidate it. The sponsor's collateral covers the debt, the rest returns to the sponsor, and the default pins the agent to tier 0." },
  { q: "How does a sponsor lock less collateral over time?", a: "Each repaid unit of principal raises the agent's tier. In the recorded run the same collateral supported 100.00 of credit at tier 0 and 245.00 after three repaid rounds. The tier thresholds are demo parameters, not calibrated risk numbers." },
  { q: "Can the record be gamed?", a: "Yes, at a cost. An agent can borrow and repay to build a record, and it pays interest to do so. Tiers above 100% are undercollateralized, which is why lenders carry that risk and why any default resets the tier." },
  { q: "Is it live?", a: "It is a testnet preview. The vault is deployed on Monad testnet and runs against the canonical x402 batch settlement contract on a fork of it. No lending or channel transaction has been sent to the testnet deployment yet, the token is a test token, and the contracts are not audited." },
  { q: "Where can I check the claims?", a: "The recorded run page lists every transaction, every refused attempt and each receipt, and recomputes receipt digests in your browser. The repository's claim ledger pairs each claim with its evidence and limits." },
];

// Banknote rosette: one ellipse turned around the centre, drawn in hairlines.
function Rosette({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="-200 -200 400 400" className={className} fill="none" stroke="currentColor" strokeWidth="0.6">
      <g className="rosette">
        {Array.from({ length: 36 }, (_, i) => <ellipse key={i} rx="190" ry="62" transform={`rotate(${i * 5})`} />)}
        {Array.from({ length: 18 }, (_, i) => <ellipse key={`b${i}`} rx="118" ry="30" transform={`rotate(${i * 10})`} />)}
        <circle r="196" />
      </g>
    </svg>
  );
}

export default function Home() {
  const g = run<{ creditLimitBeforeAusd: string; creditLimitAfterAusd: string; repaidPrincipalAusd: string }>("run-02-graduation");
  const rev = run<{ customerPaidAusd: string; agentReceivedAusd: string; debtBeforeAusd: string }>("run-03-revenue");
  const refusals = run<{ refusals: Refusal[] }>("refusals").refusals;
  const matched = refusals.filter((r) => r.expected === r.refusedWith).length;

  const CLAUSES = [
    { title: "Spend only where allowed", body: "The sponsor names the vendors. A payment to the agent's own wallet or to a stranger is refused by the contract, not by a policy document.", proof: "ReceiverNotAllowed", kind: "reverts with" },
    { title: "A cap on every channel", body: "Each channel is limited to a per channel cap, and total debt is limited by the credit ceiling.", proof: "OverPerBorrowCap", kind: "reverts with" },
    { title: "Stop it in one transaction", body: "Revoking the line ends new funding at once. Escrow already committed comes back after the channel's withdraw delay.", proof: "LineInactive", kind: "reverts with" },
    { title: "Revenue repays the loan first", body: "Payments from customers are routed through the vault. Interest and principal are settled before the agent receives the remainder.", proof: `${rev.customerPaidAusd} in → ${rev.debtBeforeAusd} to the loan`, kind: "recorded run" },
    { title: "A record any vendor can read", body: "Lifetime repaid principal is kept per agent, so the record follows the agent to a new sponsor and lowers the collateral that sponsor must lock.", proof: `${g.repaidPrincipalAusd} repaid → tier 1`, kind: "recorded run" },
    { title: "Receipts you can check", body: "Every receipt carries a digest anyone can recompute in the browser.", proof: `${proof.receipts.length} digests`, kind: "recorded run" },
  ];

  const stats: [string, string][] = [
    [`${matched}/${refusals.length}`, "out of policy attempts refused with the expected error"],
    ["0", "funds the agent holds at any point in the run"],
    ["22", "vault tests, offline and against the real x402 contract on a fork"],
    [String(proof.chainId), "Monad testnet chain id, where the vault is deployed"],
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-30 focus:bg-[var(--navy)] focus:px-4 focus:py-2 focus:text-[var(--paper)]">Skip to content</a>
      <SiteNav active="/" />
      <main id="main" className="flex flex-1 flex-col">
        <section className="relative overflow-hidden">
          <Rosette className="pointer-events-none absolute -right-40 -top-24 h-[46rem] w-[46rem] text-[var(--accent)] opacity-10 lg:opacity-25 lg:right-[-6rem]" />
          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-14 px-6 pb-24 pt-14 lg:grid-cols-[1.25fr_1fr] lg:pt-20">
            <div className="flex flex-col gap-7">
              <p className="caption">Danom · Credit for AI agents on Monad</p>
              <h1 className="text-[clamp(2.9rem,7.4vw,5.6rem)] leading-[0.96]">
                Credit for AI agents that can only spend where you <em>allow.</em>
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-[var(--fg-muted)]">
                A lender vault pays x402 channels on the agent&apos;s behalf. The agent holds a signing key and never the money. It repays from its revenue and builds a record any vendor can read.
              </p>
              <div className="flex flex-wrap items-center gap-x-7 gap-y-4 pt-1">
                <Link href="/demo" data-demo="launch-demo" className="btn btn-primary text-base">
                  Try the credit flow <span aria-hidden>→</span>
                </Link>
                <Link href="/proof" className="link-rule font-semibold">See the recorded run</Link>
              </div>
            </div>
            <div className="flex justify-center lg:justify-end">
              <Teller />
            </div>
          </div>
        </section>

        <section aria-label="Attempts the vault refused in the recorded run" className="overflow-hidden border-y-[1.5px] border-[var(--fg)] bg-[var(--paper)] py-3">
          <div className="tape font-mono text-sm">
            {[0, 1].map((copy) => (
              <ul key={copy} aria-hidden={copy === 1} className="flex shrink-0">
                {refusals.map((r) => (
                  <li key={r.attempt} className="flex items-center gap-3 whitespace-nowrap px-6">
                    <span className="text-[var(--fg-muted)]">{r.attempt}</span>
                    <span aria-hidden>→</span>
                    <span className="font-semibold text-[var(--danger)]">{r.refusedWith}</span>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </section>

        <section aria-label="Recorded run in numbers" className="mx-auto w-full max-w-6xl px-6">
          <dl className="grid grid-cols-2 md:grid-cols-4">
            {stats.map(([v, l], i) => (
              <div key={l} className={`rise flex flex-col gap-2 border-[var(--border)] py-10 pr-6 ${i % 2 ? "pl-6 max-md:border-l" : ""} ${i > 1 ? "max-md:border-t" : ""} ${i ? "md:border-l md:pl-6" : ""}`}>
                <dt className="font-[family-name:var(--font-display)] text-6xl leading-none tracking-tight">{v}</dt>
                <dd className="max-w-[16rem] text-sm text-[var(--fg-muted)]">{l}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="border-t-[1.5px] border-[var(--fg)]">
          <div className="mx-auto grid w-full max-w-6xl gap-x-16 gap-y-10 px-6 py-24 lg:grid-cols-[0.8fr_1.6fr]">
            <div className="flex flex-col gap-4 lg:sticky lg:top-28 lg:self-start">
              <p className="caption">The terms</p>
              <h2 className="text-5xl leading-[1.02]">Limits that live in the <em>contract</em></h2>
              <p className="max-w-sm text-[var(--fg-muted)]">Six clauses. Each one is enforced on chain, and each one shows what the vault answered when the recorded run tested it.</p>
            </div>
            <ol className="flex flex-col">
              {CLAUSES.map((c, i) => (
                <li key={c.title} className="rise group grid gap-x-6 gap-y-3 border-t border-[var(--border)] py-7 first:border-t-0 first:pt-0 sm:grid-cols-[3rem_1fr_auto]">
                  <span className="font-[family-name:var(--font-display)] text-3xl italic leading-none text-[var(--accent-ink)]">§{i + 1}</span>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-xl font-semibold tracking-tight">{c.title}</h3>
                    <p className="max-w-[52ch] text-[var(--fg-muted)]">{c.body}</p>
                  </div>
                  <p className="flex flex-col gap-1 sm:items-end sm:text-right">
                    <span className="caption">{c.kind}</span>
                    <span className={`border-[1.5px] px-2 py-1 font-mono text-xs font-semibold transition-transform duration-300 ease-[var(--ease-spring)] group-hover:-rotate-2 ${c.kind === "reverts with" ? "border-[var(--danger)] text-[var(--danger)]" : "border-[var(--ok)] text-[var(--ok)]"}`}>{c.proof}</span>
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t-[1.5px] border-[var(--fg)] bg-[var(--surface)]">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-14 px-6 py-24">
            <div className="flex flex-col gap-4">
              <p className="caption">The route</p>
              <h2 className="max-w-2xl text-5xl leading-[1.02]">How the money <em>moves</em></h2>
            </div>
            <ol className="grid gap-y-10 md:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s) => (
                <li key={s.n} className="rise relative flex flex-col gap-3 pr-8">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-[1.5px] border-[var(--fg)] bg-[var(--paper)] font-[family-name:var(--font-display)] text-xl">{s.n}</span>
                    <span aria-hidden className="h-0 flex-1 border-t-[1.5px] border-dashed border-[var(--fg)]" />
                    <span aria-hidden className="-ml-3 text-sm">▸</span>
                  </div>
                  <p className="caption pt-2">{s.who}</p>
                  <h3 className="text-xl font-semibold tracking-tight">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-[var(--fg-muted)]">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t-[1.5px] border-[var(--fg)]">
          <div className="mx-auto grid w-full max-w-6xl items-end gap-x-16 gap-y-12 px-6 py-24 lg:grid-cols-[1fr_1.15fr]">
            <div className="flex flex-col gap-5">
              <p className="caption">The record</p>
              <h2 className="text-5xl leading-[1.02]">A record that lowers what a sponsor has to <em>lock</em></h2>
              <p className="max-w-[52ch] text-lg text-[var(--fg-muted)]">
                The record is lifetime repaid principal, kept per agent and not per sponsor. In the recorded run the same collateral supported {g.creditLimitBeforeAusd} of credit at the start and {g.creditLimitAfterAusd} after three repaid rounds.
              </p>
              <p className="text-sm text-[var(--fg-muted)]">Thresholds are demo parameters, not calibrated risk numbers.</p>
            </div>
            <ol aria-label="Credit per unit of collateral, by tier" className="grid grid-cols-4 grid-rows-[1fr_auto] gap-x-3 sm:gap-x-4">
              {TIERS.map((t) => (
                <li key={t.tier} className="row-span-2 grid grid-rows-subgrid gap-y-0">
                  <div className="flex flex-col justify-end gap-3">
                  <p className="font-[family-name:var(--font-display)] text-3xl leading-none sm:text-5xl">{t.ltv}<span className="text-xl sm:text-2xl">%</span></p>
                  <div aria-hidden className={`bar-grow border-[1.5px] border-[var(--fg)] ${t.ltv > 100 ? "bg-[repeating-linear-gradient(135deg,var(--accent)_0_6px,transparent_6px_10px)]" : "bg-[var(--accent)]"}`} style={{ height: `${t.ltv * 0.9}px` }} />
                  </div>
                  <div className="mt-3 flex flex-col gap-1 border-t-[1.5px] border-[var(--fg)] pt-2">
                    <p className="caption !text-[var(--fg)]">Tier {t.tier}</p>
                    <p className="font-mono text-xs">{t.repaid} repaid</p>
                    <p className="hidden text-xs text-[var(--fg-muted)] sm:block">{t.note}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t-[1.5px] border-[var(--fg)] bg-[var(--paper)]">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-24">
            <div className="flex flex-col gap-4">
              <p className="caption">The fine print</p>
              <h2 className="max-w-2xl text-5xl leading-[1.02]">Questions, answered <em>straight</em></h2>
            </div>
            <dl className="grid gap-x-16 md:grid-cols-2">
              {FAQ.map((f) => (
                <div key={f.q} className="rise flex flex-col gap-2 border-t border-[var(--border)] py-6">
                  <dt className="text-lg font-semibold tracking-tight">{f.q}</dt>
                  <dd className="text-sm leading-relaxed text-[var(--fg-muted)]">{f.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="on-ink relative overflow-hidden bg-[var(--navy)] text-[var(--paper)]">
          <Rosette className="pointer-events-none absolute -bottom-72 -right-40 h-[44rem] w-[44rem] text-[var(--sky)] opacity-20" />
          <div className="relative mx-auto flex w-full max-w-6xl flex-col items-start gap-7 border-b border-[color-mix(in_srgb,var(--paper)_18%,transparent)] px-6 py-24">
            <h2 className="max-w-3xl text-5xl leading-[1.0] sm:text-7xl">Fund a channel, hit a refusal, watch the record <em className="!text-[var(--sky)]">grow.</em></h2>
            <p className="max-w-xl text-lg text-[var(--surface-raised)]">The credit flow runs the vault&apos;s rules in your browser. No wallet needed.</p>
            <Link href="/demo" className="btn text-base">
              Try the credit flow <span aria-hidden>→</span>
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
