import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/page-shell";
import proof from "@/PROOF_RUNS.json";

const STEPS = [
  { n: "01", title: "A lender funds the vault", body: "Lenders supply stablecoin to one shared pool and earn the interest borrowers pay." },
  { n: "02", title: "A sponsor sets the leash", body: "A person or a DAO locks collateral and names the vendors the agent may pay, a cap per channel, a credit ceiling and an expiry." },
  { n: "03", title: "The vault pays, the agent signs", body: "The vault opens x402 payment channels to approved vendors. The agent holds only a voucher signing key. It never holds the money." },
  { n: "04", title: "Revenue repays first", body: "Customers pay the agent through the vault. A share goes to the loan before the agent sees the rest." },
];
const STEP_TONES = ["bg-[var(--sky)]", "bg-[#d6f8ea]", "bg-[#fff0a8]", "bg-[#ffdcd5]"];

const FEATURES = [
  { title: "Spend only where allowed", body: "The sponsor names the vendors. A payment to the agent's own wallet or to a stranger is refused by the contract, not by a policy document.", tone: "bg-[var(--navy)] text-white", sub: "text-[var(--sky)]", span: "md:col-span-2" },
  { title: "A cap on every channel", body: "Each channel is limited to a per channel cap, and total debt is limited by the credit ceiling.", tone: "bg-[var(--sky)]", sub: "text-[var(--navy-soft)]", span: "" },
  { title: "Stop it in one transaction", body: "Revoking the line ends new funding at once. Escrow already committed comes back after the channel's withdraw delay.", tone: "bg-[#fff0a8]", sub: "text-[var(--navy-soft)]", span: "" },
  { title: "Revenue repays the loan first", body: "Payments from customers are routed through the vault. Interest and principal are settled before the agent receives the remainder.", tone: "bg-[#d6f8ea]", sub: "text-[var(--navy-soft)]", span: "" },
  { title: "A record any vendor can read", body: "Lifetime repaid principal is kept per agent, so the record follows the agent to a new sponsor and lowers the collateral that sponsor must lock.", tone: "bg-[#ffdcd5]", sub: "text-[var(--navy-soft)]", span: "md:col-span-2" },
  { title: "Receipts you can check", body: "Every receipt carries a digest anyone can recompute in the browser.", tone: "bg-[var(--surface-raised)]", sub: "text-[var(--navy-soft)]", span: "" },
];

const TIERS = [
  { tier: "0", repaid: "under 100", ltv: "75%", note: "New agent. Credit is less than the collateral." },
  { tier: "1", repaid: "100 or more", ltv: "100%", note: "First tier a record buys." },
  { tier: "2", repaid: "500 or more", ltv: "150%", note: "Undercollateralized. Lenders carry the gap." },
  { tier: "3", repaid: "2,000 or more", ltv: "250%", note: "Any default drops the agent back to tier 0." },
];

const FAQ = [
  { q: "Can the agent run off with the money?", a: "No. The agent holds a voucher signing key and nothing else. The vault escrows funds in x402 channels to vendors the sponsor approved. One limit remains: an agent and an approved vendor that collude can claim a channel's full escrow, so the channel deposit is the most that can be lost." },
  { q: "What happens if the agent does not repay?", a: "Once a line is overdue with debt outstanding, anyone can liquidate it. The sponsor's collateral covers the debt, the rest returns to the sponsor, and the default pins the agent to tier 0." },
  { q: "How does a sponsor lock less collateral over time?", a: "Each repaid unit of principal raises the agent's tier. In the recorded run the same collateral supported 100.00 of credit at tier 0 and 245.00 after three repaid rounds. The tier thresholds are demo parameters, not calibrated risk numbers." },
  { q: "Can the record be gamed?", a: "Yes, at a cost. An agent can borrow and repay to build a record, and it pays interest to do so. Tiers above 100% are undercollateralized, which is why lenders carry that risk and why any default resets the tier." },
  { q: "Is it live?", a: "It is a testnet preview. The vault is deployed on Monad testnet and runs against the canonical x402 batch settlement contract on a fork of it. No lending or channel transaction has been sent to the testnet deployment yet, the token is a test token, and the contracts are not audited." },
  { q: "Where can I check the claims?", a: "The recorded run page lists every transaction, every refused attempt and each receipt, and recomputes receipt digests in your browser. The repository's claim ledger pairs each claim with its evidence and limits." },
];

export default function Home() {
  const g = proof.runs.find((r) => r.id === "run-02-graduation") as { creditLimitBeforeAusd: string; creditLimitAfterAusd: string; repaidPrincipalAusd: string };
  const refusals = (proof.runs.find((r) => r.id === "refusals") as { refusals: { attempt: string; expected: string; refusedWith: string }[] }).refusals;
  const matched = refusals.filter((r) => r.expected === r.refusedWith).length;
  const before = parseFloat(g.creditLimitBeforeAusd);
  const after = parseFloat(g.creditLimitAfterAusd);
  const cta = "group inline-flex items-center gap-3 rounded-[var(--radius-pill)] py-2 pl-6 pr-2 text-base font-semibold transition-all duration-300 active:scale-[0.98]";
  const primary = `${cta} bg-[var(--accent)] text-[var(--accent-contrast)] hover:bg-[var(--navy)] hover:text-white`;
  const arrow = "grid h-10 w-10 place-items-center rounded-full bg-[var(--navy)] text-white transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5";
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-30 focus:rounded-full focus:bg-[var(--navy)] focus:px-4 focus:py-2 focus:text-white">Skip to content</a>
      <SiteNav active="/" />
      <main id="main" className="flex flex-1 flex-col">
        <section className="hero-wash">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 pb-20 pt-16 lg:grid-cols-[1.1fr_1fr]">
            <div className="flex flex-col gap-6">
              <p className="font-mono text-sm font-medium text-[var(--accent-ink)]">Danom · Credit for AI agents on Monad</p>
              <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">Credit for AI agents that can only spend where you allow.</h1>
              <p className="max-w-xl text-lg text-[var(--fg-muted)]">
                A lender vault pays x402 channels on the agent&apos;s behalf. The agent holds a signing key and never the money. It repays from its revenue and builds a record any vendor can read.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link href="/demo" data-demo="launch-demo" className={primary}>
                  Try the credit flow
                  <span aria-hidden className={arrow}>↗</span>
                </Link>
                <Link href="/proof" className={`${cta} border border-[var(--navy)] bg-white pr-6 hover:bg-[var(--navy)] hover:text-white`}>
                  See the recorded run
                </Link>
              </div>
            </div>

            <div className="drift flex flex-col gap-4 rounded-[var(--radius)] border border-[var(--border)] bg-white p-6 shadow-[var(--shadow)]" aria-label="Credit line summary from the recorded run">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Credit line</p>
                <span className="rounded-full bg-[#d6f8ea] px-3 py-1 text-xs font-semibold text-[var(--ok)]">Active</span>
              </div>
              <div>
                <p className="text-sm text-[var(--fg-muted)]">Credit limit on the same collateral</p>
                <p className="mt-1 font-mono text-4xl font-semibold">{g.creditLimitAfterAusd}</p>
                <p className="mt-1 text-sm text-[var(--fg-muted)]">was <span className="font-mono">{g.creditLimitBeforeAusd}</span> before <span className="font-mono">{g.repaidPrincipalAusd}</span> was repaid</p>
              </div>
              <div role="img" aria-label={`Credit limit grew from ${before} to ${after}`} className="h-3 overflow-hidden rounded-full bg-[var(--surface-raised)]">
                <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.round((before / after) * 100)}%` }} />
              </div>
              <ul className="flex flex-col gap-2 border-t border-[var(--border)] pt-4 text-sm">
                {refusals.slice(0, 3).map((r) => (
                  <li key={r.attempt} className="flex items-start justify-between gap-4">
                    <span className="text-[var(--fg-muted)]">{r.attempt}</span>
                    <span className="shrink-0 rounded-full bg-[#fdecef] px-2.5 py-0.5 font-mono text-xs font-semibold text-[var(--danger)]">{r.refusedWith}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section aria-label="Recorded run in numbers" className="border-y border-[var(--border)] bg-white">
          <dl className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-8 px-6 py-10 md:grid-cols-4">
            {[
              [`${matched}/${refusals.length}`, "out of policy attempts refused with the expected error"],
              ["0", "funds the agent holds at any point in the run"],
              ["22", "vault tests, offline and against the real x402 contract on a fork"],
              ["10143", "Monad testnet chain id, where the vault is deployed"],
            ].map(([v, l]) => (
              <div key={l} className="flex flex-col gap-1">
                <dt className="font-mono text-4xl font-semibold tracking-tight">{v}</dt>
                <dd className="text-sm text-[var(--fg-muted)]">{l}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="mx-auto flex w-full max-w-6xl flex-col gap-24 px-6 py-24">
          <section className="flex flex-col gap-8">
            <h2 className="max-w-2xl text-4xl font-semibold tracking-tight">Limits that live in the contract</h2>
            <div className="grid grid-flow-dense gap-4 md:grid-cols-4">
              {FEATURES.map((f) => (
                <div key={f.title} className={`flex flex-col gap-3 rounded-[var(--radius)] p-8 transition-transform duration-500 ease-[var(--ease-spring)] hover:-translate-y-1 ${f.tone} ${f.span || "md:col-span-1"}`}>
                  <h3 className="text-2xl font-semibold">{f.title}</h3>
                  <p className={`text-base ${f.sub}`}>{f.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-8">
            <h2 className="max-w-2xl text-4xl font-semibold tracking-tight">How the money moves</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <div key={s.n} className={`flex flex-col gap-3 rounded-[var(--radius)] p-6 transition-transform duration-500 ease-[var(--ease-spring)] hover:-translate-y-1 ${STEP_TONES[i]}`}>
                  <span className="font-mono text-sm font-semibold text-[var(--navy-soft)]">{s.n}</span>
                  <h3 className="text-xl font-semibold">{s.title}</h3>
                  <p className="text-sm text-[var(--navy-soft)]">{s.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid items-start gap-10 md:grid-cols-2">
            <div className="flex flex-col gap-4">
              <h2 className="text-4xl font-semibold tracking-tight">A record that lowers what a sponsor has to lock</h2>
              <p className="text-lg text-[var(--fg-muted)]">
                The record is lifetime repaid principal, kept per agent and not per sponsor. In the recorded run the same collateral supported {g.creditLimitBeforeAusd} of credit at the start and {g.creditLimitAfterAusd} after three repaid rounds.
              </p>
              <p className="text-sm text-[var(--fg-muted)]">Thresholds are demo parameters, not calibrated risk numbers.</p>
            </div>
            <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)] shadow-[var(--shadow)]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--surface-raised)] text-[var(--navy-soft)]">
                  <tr><th className="px-4 py-3 font-semibold">Tier</th><th className="px-4 py-3 font-semibold">Repaid</th><th className="px-4 py-3 font-semibold">Credit per unit of collateral</th></tr>
                </thead>
                <tbody>
                  {TIERS.map((t) => (
                    <tr key={t.tier} className="border-t border-[var(--border)]">
                      <td className="px-4 py-3 font-mono font-semibold">{t.tier}</td>
                      <td className="px-4 py-3 font-mono">{t.repaid}</td>
                      <td className="px-4 py-3"><span className="font-mono font-semibold">{t.ltv}</span> <span className="text-[var(--fg-muted)]">{t.note}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-10 md:grid-cols-[1fr_1.6fr]">
            <h2 className="text-4xl font-semibold tracking-tight">Questions, answered straight</h2>
            <div className="flex flex-col gap-3">
              {FAQ.map((f) => (
                <details key={f.q} className="group rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-5 py-4 open:bg-white open:shadow-[var(--shadow)]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold">
                    {f.q}
                    <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--surface-raised)] text-[var(--accent-ink)] transition-transform duration-300 group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-sm text-[var(--fg-muted)]">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        </div>

        <section className="bg-[var(--navy)] text-white">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-6 py-20">
            <h2 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">Fund a channel, hit a refusal, watch the record grow.</h2>
            <p className="max-w-xl text-lg text-[var(--sky)]">The credit flow runs the vault&apos;s rules in your browser. No wallet needed.</p>
            <Link href="/demo" className={primary}>
              Try the credit flow
              <span aria-hidden className={arrow}>↗</span>
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
