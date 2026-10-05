import { PageShell } from "@/components/page-shell";
import { ReceiptVerifier, type ReceiptRow } from "@/components/receipt-verifier";
import proof from "@/PROOF_RUNS.json";

type Run = Record<string, unknown> & { id: string; title: string };
const runs = proof.runs as unknown as Run[];
const refusals = (runs.find((r) => r.id === "refusals") as unknown as { refusals: { attempt: string; expected: string; refusedWith: string }[] }).refusals;
const keyRuns = runs.filter((r) => r.id !== "refusals");
const TONES = ["bg-[var(--sky)]", "bg-[#d6f8ea]", "bg-[#fff0a8]", "bg-[#ffdcd5]"];
const label = (k: string) => k.replace(/Ausd$/, "").replace(/([A-Z])/g, " $1").toLowerCase();

export default function Proof() {
  return (
    <PageShell
      active="/proof"
      title="The recorded run"
      intro={
        <>
          <p className="rounded-[var(--radius-sm)] border border-[var(--sun)] bg-[var(--warn-bg)] px-4 py-3 text-sm text-[var(--fg)]">{proof.note}</p>
          <p className="text-sm">Mode <span className="font-mono">{proof.verificationMode}</span>. Generated {proof.generatedAt}. Re-run it with <span className="font-mono">pnpm proof:local</span>.</p>
        </>
      }
    >
        <section className="flex flex-col gap-3">
          <h2 className="text-3xl font-semibold tracking-tight">Contracts</h2>
          <dl className="grid gap-2 rounded-[var(--radius)] bg-[var(--navy)] p-6 text-sm md:grid-cols-[max-content_1fr] md:gap-x-6">
            {Object.entries(proof.contracts).map(([name, addr]) => (
              <div key={name} className="contents">
                <dt className="font-semibold text-[var(--mint)]">{name}</dt>
                <dd className="break-all font-mono text-[var(--sky)]">{addr}{name === "x402BatchSettlement" ? " (canonical, has code on Monad testnet 10143 and mainnet 143)" : " (local fork only)"}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {keyRuns.map((r, i) => (
            <div key={r.id} className={`rounded-[var(--radius)] p-6 ${TONES[i % TONES.length]}`}>
              <h3 className="mb-4 text-xl font-semibold">{r.title}</h3>
              <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
                {Object.entries(r).filter(([k]) => k !== "id" && k !== "title").map(([k, v]) => (
                  <div key={k} className="contents"><dt className="text-[var(--navy-soft)]">{label(k)}</dt><dd className="text-right font-mono">{String(v)}</dd></div>
                ))}
              </dl>
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-3xl font-semibold tracking-tight">Attempts that were refused</h2>
          <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--border)] shadow-[var(--shadow)]">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-[var(--surface-raised)] text-[var(--navy-soft)]"><tr><th className="px-4 py-3 font-semibold">Attempt</th><th className="px-4 py-3 font-semibold">Expected</th><th className="px-4 py-3 font-semibold">Chain said</th></tr></thead>
              <tbody>
                {refusals.map((a) => (
                  <tr key={a.attempt} className="border-t border-[var(--border)]">
                    <td className="px-4 py-3">{a.attempt}</td>
                    <td className="px-4 py-3 font-mono">{a.expected}</td>
                    <td className={`px-4 py-3 font-mono ${a.expected === a.refusedWith ? "text-[var(--ok)]" : "text-[var(--danger)]"}`}>{a.refusedWith}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-3xl font-semibold tracking-tight">Receipts, checked in your browser</h2>
          <p className="max-w-3xl text-sm text-[var(--fg-muted)] [text-wrap:pretty]">Each digest is recomputed from the receipt&apos;s own fields. It proves a receipt was not edited after the fact. It is not a signature.</p>
          <ReceiptVerifier receipts={proof.receipts as unknown as ReceiptRow[]} chainId={proof.chainId} contract={proof.contracts.CreditVault} />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-3xl font-semibold tracking-tight">Transactions ({proof.transactions.length})</h2>
          <ol className="grid gap-2 text-sm">
            {proof.transactions.map((t, i) => (
              <li key={t.hash} className="flex flex-wrap gap-x-3 rounded-[var(--radius-sm)] bg-[var(--surface)] px-4 py-2"><span className="font-mono text-[var(--fg-muted)]">{String(i + 1).padStart(2, "0")}</span><span>{t.step}</span><span className="font-mono text-[var(--fg-muted)]">block {t.block}</span></li>
            ))}
          </ol>
        </section>
    </PageShell>
  );
}
