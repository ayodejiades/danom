import { PageShell } from "@/components/page-shell";
import { ReceiptVerifier, type ReceiptRow } from "@/components/receipt-verifier";
import proof from "@/PROOF_RUNS.json";

type Run = Record<string, unknown> & { id: string; title: string };
const runs = proof.runs as unknown as Run[];
const refusals = (runs.find((r) => r.id === "refusals") as unknown as { refusals: { attempt: string; expected: string; refusedWith: string }[] }).refusals;
const keyRuns = runs.filter((r) => r.id !== "refusals");
const label = (k: string) => k.replace(/Ausd$/, "").replace(/([A-Z])/g, " $1").toLowerCase();

export default function Proof() {
  return (
    <PageShell
      active="/proof"
      eyebrow={`Local fork of chain ${proof.chainId} · ${proof.transactions.length} transactions`}
      title={<>The recorded <em>run</em></>}
      intro={
        <>
          <p className="rounded-[var(--radius-sm)] border-[1.5px] border-[var(--fg)] bg-[var(--warn-bg)] px-4 py-3 text-sm text-[var(--fg)]">{proof.note}</p>
          <p className="text-sm">Mode <span className="font-mono">{proof.verificationMode}</span>. Generated {proof.generatedAt}. Re-run it with <span className="font-mono">pnpm proof:local</span>.</p>
        </>
      }
    >
        <section className="flex flex-col gap-3">
          <h2 className="text-4xl">Contracts</h2>
          <dl className="grid gap-x-8 gap-y-3 rounded-[var(--radius)] border-[1.5px] border-[var(--fg)] bg-[var(--paper)] p-6 text-sm md:grid-cols-[max-content_1fr]">
            {Object.entries(proof.contracts).map(([name, addr]) => (
              <div key={name} className="contents">
                <dt className="caption !text-[var(--fg)]">{name}</dt>
                <dd className="break-all font-mono text-[var(--fg-muted)]">{addr}{name === "x402BatchSettlement" ? " (canonical, has code on Monad testnet 10143 and mainnet 143)" : " (local fork only)"}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          {keyRuns.map((r, i) => (
            <div key={r.id} className="rise rounded-[var(--radius)] border-[1.5px] border-[var(--fg)] bg-[var(--paper)] p-6">
              <p className="caption mb-2">Run {String(i + 1).padStart(2, "0")}</p>
              <h3 className="mb-5 text-xl font-semibold tracking-tight">{r.title}</h3>
              <dl className="grid grid-cols-[1fr_auto] gap-x-4 text-sm">
                {Object.entries(r).filter(([k]) => k !== "id" && k !== "title").map(([k, v]) => (
                  <div key={k} className="col-span-2 grid grid-cols-subgrid border-t border-dashed border-[var(--border)] py-1.5"><dt className="text-[var(--fg-muted)]">{label(k)}</dt><dd className="text-right font-mono font-medium">{String(v)}</dd></div>
                ))}
              </dl>
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-4xl">Attempts that were refused</h2>
          <div className="overflow-x-auto rounded-[var(--radius)] border-[1.5px] border-[var(--fg)] bg-[var(--paper)]">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b-[1.5px] border-[var(--fg)] text-[var(--fg-muted)]"><tr><th className="px-4 py-3 font-semibold">Attempt</th><th className="px-4 py-3 font-semibold">Expected</th><th className="px-4 py-3 font-semibold">Chain said</th></tr></thead>
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
          <h2 className="text-4xl">Receipts, checked in your browser</h2>
          <p className="max-w-3xl text-sm text-[var(--fg-muted)] [text-wrap:pretty]">Each digest is recomputed from the receipt&apos;s own fields. It proves a receipt was not edited after the fact. It is not a signature.</p>
          <ReceiptVerifier receipts={proof.receipts as unknown as ReceiptRow[]} chainId={proof.chainId} contract={proof.contracts.CreditVault} />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-4xl">Transactions ({proof.transactions.length})</h2>
          <ol className="grid text-sm">
            {proof.transactions.map((t, i) => (
              <li key={t.hash} className="flex flex-wrap gap-x-4 border-t border-dashed border-[var(--border)] py-2"><span className="font-mono text-[var(--fg-muted)]">{String(i + 1).padStart(2, "0")}</span><span>{t.step}</span><span className="font-mono text-[var(--fg-muted)]">block {t.block}</span></li>
            ))}
          </ol>
        </section>
    </PageShell>
  );
}
