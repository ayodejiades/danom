import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/page-shell";
import proof from "@/PROOF_RUNS.json";

const STEP_TONES = ["bg-[var(--sky)]", "bg-[#d6f8ea]", "bg-[#fff0a8]", "bg-[#ffdcd5]"];

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
  const cta = "group inline-flex items-center gap-3 rounded-[var(--radius-pill)] py-2 pl-6 pr-2 text-base font-semibold transition-all duration-300 active:scale-[0.98]";
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-30 focus:rounded-full focus:bg-[var(--navy)] focus:px-4 focus:py-2 focus:text-white">Skip to content</a>
      <SiteNav active="/" />
      <main id="main" className="flex flex-1 flex-col">
        <section className="hero-wash">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 pb-20 pt-16 lg:grid-cols-[1.25fr_1fr]">
            <div className="flex flex-col gap-6">
              <p className="font-mono text-sm font-medium text-[var(--accent-ink)]">Monad Metropolis · Trust, Identity and AI Infrastructure</p>
              <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">Credit for AI agents that can only spend where you allow.</h1>
              <p className="max-w-xl text-lg text-[var(--fg-muted)]">
                A lender vault pays x402 channels on the agent&apos;s behalf. The agent holds a signing key and never the money. It repays from its revenue, builds a record any vendor can read, and its sponsor can lock less collateral as that record grows.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link href="/demo" data-demo="launch-demo" className={`${cta} bg-[var(--accent)] text-[var(--accent-contrast)] hover:bg-[var(--navy)] hover:text-white`}>
                  Try the credit flow
                  <span aria-hidden className="grid h-10 w-10 place-items-center rounded-full bg-[var(--navy)] text-white transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5">↗</span>
                </Link>
                <Link href="/proof" className={`${cta} border border-[var(--navy)] bg-white pr-6 hover:bg-[var(--navy)] hover:text-white`}>
                  See the recorded run
                </Link>
              </div>
            </div>
            <div className="relative grid grid-cols-2 gap-4" aria-label="Recorded run headline numbers">
              <div className="drift col-span-2 rounded-[var(--radius)] bg-[var(--navy)] p-6 text-white shadow-[var(--shadow)]">
                <p className="text-sm text-[var(--sky)]">Credit limit on the same collateral</p>
                <p className="mt-2 font-mono text-4xl font-semibold">{g.creditLimitBeforeAusd} → {g.creditLimitAfterAusd}</p>
                <p className="mt-2 text-sm text-[var(--sky)]">after three repaid rounds</p>
              </div>
              <div className="rounded-[var(--radius)] bg-[var(--mint)] p-5 text-[var(--navy)]">
                <p className="font-mono text-4xl font-semibold">{matched}/{refusals.length}</p>
                <p className="mt-1 text-sm font-medium">out of policy attempts refused as expected</p>
              </div>
              <div className="rounded-[var(--radius)] bg-[var(--sun)] p-5 text-[var(--navy)]">
                <p className="font-mono text-4xl font-semibold">0</p>
                <p className="mt-1 text-sm font-medium">funds the agent ever holds</p>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto flex w-full max-w-6xl flex-col gap-24 px-6 py-20">
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
                The record is lifetime repaid principal, kept per agent and not per sponsor, so it follows the agent to a new sponsor. In the recorded run the same collateral supported {g.creditLimitBeforeAusd} of credit at the start and {g.creditLimitAfterAusd} after three repaid rounds.
              </p>
              <p className="text-sm text-[var(--fg-muted)]">Thresholds are demo parameters, not calibrated risk numbers. The record can be farmed at the cost of interest, and tiers above 100% are undercollateralized.</p>
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
        </div>

        <section className="bg-[var(--navy)] text-white">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-20">
            <h2 className="text-4xl font-semibold tracking-tight">What is real today</h2>
            <ul className="grid gap-4 text-sm md:grid-cols-2">
              <li className="rounded-[var(--radius)] bg-[var(--navy-soft)] p-6"><span className="font-semibold text-[var(--mint)]">Real:</span> <span className="text-[var(--sky)]">the vault runs against the canonical x402 batch settlement contract on an Anvil fork of Monad testnet. {matched} of {refusals.length} attempts outside the policy were refused with the expected error.</span></li>
              <li className="rounded-[var(--radius)] bg-[var(--navy-soft)] p-6"><span className="font-semibold text-[var(--sun)]">Not done:</span> <span className="text-[var(--sky)]">the vault is deployed on Monad testnet, but no lending or channel transaction has been sent to it. The recorded run is on a fork, the token is a mock, and the Monad x402 facilitator was not called.</span></li>
              <li className="rounded-[var(--radius)] bg-[var(--navy-soft)] p-6"><span className="font-semibold text-[var(--coral)]">Not integrated:</span> <span className="text-[var(--sky)]">Dynamic, Privy and Envio. The repository says so in docs/SPONSOR_INTEGRATIONS.md.</span></li>
              <li className="rounded-[var(--radius)] bg-[var(--navy-soft)] p-6"><span className="font-semibold text-[var(--accent)]">Known limit:</span> <span className="text-[var(--sky)]">an agent and an approved vendor that collude can claim a channel&apos;s full escrow, so the channel deposit is the most that can be lost.</span></li>
            </ul>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
