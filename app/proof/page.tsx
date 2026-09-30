import { SiteNav } from "@/components/site-nav";
import { ReceiptVerifier, type ReceiptRow } from "@/components/receipt-verifier";
import proof from "@/PROOF_RUNS.json";

type Run = Record<string, unknown> & { id: string; title: string };
const runs = proof.runs as unknown as Run[];
const refusals = (runs.find((r) => r.id === "refusals") as unknown as { refusals: { attempt: string; expected: string; refusedWith: string }[] }).refusals;
const keyRuns = runs.filter((r) => r.id !== "refusals");
const label = (k: string) => k.replace(/Ausd$/, "").replace(/([A-Z])/g, " $1").toLowerCase();

export default function Proof() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav active="/proof" />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-6 py-10">
        <header className="flex max-w-3xl flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-tight [text-wrap:balance]">The recorded run</h1>
          <p className="rounded-[var(--radius-sm)] border border-[#a16207] bg-[#a1620722] px-4 py-3 text-sm [text-wrap:pretty]">{proof.note}</p>
          <p className="text-sm text-[var(--fg-muted)]">Mode <span className="font-mono">{proof.verificationMode}</span>. Generated {proof.generatedAt}. Re-run it with <span className="font-mono">pnpm proof:local</span>.</p>
        </header>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Contracts</h2>
          <dl className="grid gap-2 text-sm md:grid-cols-[max-content_1fr]">
            {Object.entries(proof.contracts).map(([name, addr]) => (
              <div key={name} className="contents">
                <dt className="text-[var(--fg-muted)]">{name}</dt>
                <dd className="break-all font-mono">{addr}{name === "x402BatchSettlement" ? " (canonical, has code on Monad testnet 10143 and mainnet 143)" : " (local fork only)"}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {keyRuns.map((r) => (
            <div key={r.id} className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5">
              <h3 className="mb-3 text-base font-semibold [text-wrap:balance]">{r.title}</h3>
              <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
                {Object.entries(r).filter(([k]) => k !== "id" && k !== "title").map(([k, v]) => (
                  <div key={k} className="contents"><dt className="text-[var(--fg-muted)]">{label(k)}</dt><dd className="text-right font-mono">{String(v)}</dd></div>
                ))}
              </dl>
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Attempts that were refused</h2>
          <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--border)]">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-[var(--surface)] text-[var(--fg-muted)]"><tr><th className="px-3 py-2 font-medium">Attempt</th><th className="px-3 py-2 font-medium">Expected</th><th className="px-3 py-2 font-medium">Chain said</th></tr></thead>
              <tbody>
                {refusals.map((a) => (
                  <tr key={a.attempt} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2">{a.attempt}</td>
                    <td className="px-3 py-2 font-mono">{a.expected}</td>
                    <td className={`px-3 py-2 font-mono ${a.expected === a.refusedWith ? "text-[var(--accent)]" : "text-[#f87171]"}`}>{a.refusedWith}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Receipts, checked in your browser</h2>
          <p className="max-w-3xl text-sm text-[var(--fg-muted)] [text-wrap:pretty]">Each digest is recomputed from the receipt&apos;s own fields. It proves a receipt was not edited after the fact. It is not a signature.</p>
          <ReceiptVerifier receipts={proof.receipts as unknown as ReceiptRow[]} chainId={proof.chainId} contract={proof.contracts.CreditVault} />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Transactions ({proof.transactions.length})</h2>
          <ol className="grid gap-1 text-sm">
            {proof.transactions.map((t, i) => (
              <li key={t.hash} className="flex flex-wrap gap-x-3"><span className="font-mono text-[var(--fg-muted)]">{String(i + 1).padStart(2, "0")}</span><span>{t.step}</span><span className="font-mono text-[var(--fg-muted)]">block {t.block}</span></li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}
