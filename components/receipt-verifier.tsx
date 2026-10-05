"use client";

import { useState } from "react";
import { receiptDigest } from "@/lib/stream";

export interface ReceiptRow {
  kind: string; id: string; from: string; to: string; amountUnits: string; amountAusd: string; txHash: string; blockNumber: string; digest: string;
}

const short = (s: string) => (s.length > 14 ? `${s.slice(0, 8)}…${s.slice(-6)}` : s);

export function ReceiptVerifier({ receipts, chainId, contract }: { receipts: ReceiptRow[]; chainId: number; contract: string }) {
  const [tamper, setTamper] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 text-sm text-[var(--fg-muted)]">
        <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={tamper} onChange={(e) => setTamper(e.target.checked)} />
        Add 1 unit (0.000001) to every amount before recomputing, to see the check fail
      </label>
      <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--border)] shadow-[var(--shadow)]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-[var(--surface-raised)] text-[var(--navy-soft)]">
            <tr><th className="px-4 py-3 font-semibold">Receipt</th><th className="px-4 py-3 font-semibold">Amount</th><th className="px-4 py-3 font-semibold">Transaction</th><th className="px-4 py-3 font-semibold">Digest</th><th className="px-4 py-3 font-semibold">Check</th></tr>
          </thead>
          <tbody>
            {receipts.map((r, i) => {
              const amount = BigInt(r.amountUnits) + (tamper ? BigInt(1) : BigInt(0));
              const recomputed = receiptDigest({ chainId, contract, kind: r.kind, id: r.id, from: r.from, to: r.to, amount, txHash: r.txHash });
              const ok = recomputed === r.digest;
              return (
                <tr key={`${r.txHash}-${i}`} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 font-mono">{r.kind}</td>
                  <td className="px-4 py-3 font-mono">{r.amountAusd}</td>
                  <td className="px-4 py-3 font-mono text-[var(--fg-muted)]">{short(r.txHash)}</td>
                  <td className="px-4 py-3 font-mono text-[var(--fg-muted)]">{short(r.digest)}</td>
                  <td className={`px-4 py-3 font-semibold ${ok ? "text-[var(--ok)]" : "text-[var(--danger)]"}`}>{ok ? "Matches" : "Does not match"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
