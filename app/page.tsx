import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import proof from "@/PROOF_RUNS.json";

const STEPS = [
  { n: "01", title: "A lender funds the vault", body: "Lenders supply stablecoin to one shared pool and earn the interest borrowers pay." },
  { n: "02", title: "A sponsor sets the leash", body: "A person or a DAO locks collateral and names the vendors the agent may pay, a cap per channel, a credit ceiling and an expiry." },
  { n: "03", title: "The vault pays, the agent signs", body: "The vault opens x402 payment channels to approved vendors. The agent holds only a voucher signing key. It never holds the money." },
  { n: "04", title: "Revenue repays first", body: "Customers pay the agent through the vault. A share goes to the loan before the agent sees the rest." },
];

const TIERS = [
  { tier: "0", repaid: "under 100", ltv: "75%", note: "New agent. Credit is less than the collateral." },
  { tier: "1", repaid: "100 or more", ltv: "100%", note: "First tier a record buys." },
  { tier: "2", repaid: "500 or more", ltv: "150%", note: "Undercollateralized. Lenders carry the gap." },
  { tier: "3", repaid: "2,000 or more", ltv: "250%", note: "Any default drops the agent back to tier 0." },
];

export default function Home() {
  const g = proof.runs.find((r) => r.id === "run-02-graduation") as { creditLimitBeforeAusd: string; creditLimitAfterAusd: string };
  const refusals = (proof.runs.find((r) => r.id === "refusals") as { refusals: { expected: string; refusedWith: string }[] }).refusals;
  const matched = refusals.filter((r) => r.expected === r.refusedWith).length;
  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav active="/" />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-20 px-6 py-16">
        <section className="flex max-w-3xl flex-col gap-6">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--accent)]">Monad Metropolis · Trust, Identity and AI Infrastructure</p>
          <h1 className="text-4xl font-semibold tracking-tight [text-wrap:balance] sm:text-5xl">Credit for AI agents that can only spend where you allow.</h1>
          <p className="text-lg text-[var(--fg-muted)] [text-wrap:pretty]">
            A lender vault pays x402 channels on the agent&apos;s behalf. The agent holds a signing key and never the money. It repays from its revenue, builds a record any vendor can read, and its sponsor can lock less collateral as that record grows.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/demo" data-demo="launch-demo" className="rounded-[var(--radius-sm)] bg-[var(--accent)] px-4 py-2.5 text-base font-semibold text-[var(--accent-contrast)] hover:opacity-90">
              Try the credit flow
            </Link>
            <Link href="/proof" className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-2.5 text-base font-semibold hover:bg-[var(--surface)]">
              See the recorded run
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5">
              <span className="font-mono text-xs text-[var(--accent)]">{s.n}</span>
              <h2 className="text-base font-semibold [text-wrap:balance]">{s.title}</h2>
              <p className="text-sm text-[var(--fg-muted)] [text-wrap:pretty]">{s.body}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-8 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <h2 className="text-2xl font-semibold tracking-tight [text-wrap:balance]">A record that lowers what a sponsor has to lock</h2>
            <p className="text-[var(--fg-muted)] [text-wrap:pretty]">
              The record is lifetime repaid principal, kept per agent and not per sponsor, so it follows the agent to a new sponsor. In the recorded run the same collateral supported {g.creditLimitBeforeAusd} of credit at the start and {g.creditLimitAfterAusd} after three repaid rounds.
            </p>
            <p className="text-sm text-[var(--fg-muted)] [text-wrap:pretty]">Thresholds are demo parameters, not calibrated risk numbers. The record can be farmed at the cost of interest, and tiers above 100% are undercollateralized.</p>
          </div>
          <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--surface)] text-[var(--fg-muted)]">
                <tr><th className="px-4 py-2 font-medium">Tier</th><th className="px-4 py-2 font-medium">Repaid</th><th className="px-4 py-2 font-medium">Credit per unit of collateral</th></tr>
              </thead>
              <tbody>
                {TIERS.map((t) => (
                  <tr key={t.tier} className="border-t border-[var(--border)]">
                    <td className="px-4 py-2 font-mono">{t.tier}</td>
                    <td className="px-4 py-2 font-mono">{t.repaid}</td>
                    <td className="px-4 py-2"><span className="font-mono">{t.ltv}</span> <span className="text-[var(--fg-muted)]">{t.note}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="text-2xl font-semibold tracking-tight [text-wrap:balance]">What is real today</h2>
          <ul className="grid gap-3 text-sm text-[var(--fg-muted)] md:grid-cols-2">
            <li><span className="text-[var(--fg)]">Real:</span> the vault runs against the canonical x402 batch settlement contract on an Anvil fork of Monad testnet. {matched} of {refusals.length} attempts outside the policy were refused with the expected error.</li>
            <li><span className="text-[var(--fg)]">Not done:</span> no transaction was sent to Monad, the token is a mock, and the Monad x402 facilitator was not called.</li>
            <li><span className="text-[var(--fg)]">Not integrated:</span> Dynamic, Privy and Envio. The repository says so in docs/SPONSOR_INTEGRATIONS.md.</li>
            <li><span className="text-[var(--fg)]">Known limit:</span> an agent and an approved vendor that collude can claim a channel&apos;s full escrow, so the channel deposit is the most that can be lost.</li>
          </ul>
        </section>
      </main>
      <footer className="border-t border-[var(--border)] px-6 py-6 text-center text-xs text-[var(--fg-muted)]">Built for Monad Metropolis. Contracts are not audited.</footer>
    </div>
  );
}
