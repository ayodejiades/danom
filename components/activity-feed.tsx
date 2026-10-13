"use client";

import { useEffect, useState } from "react";

interface Activity {
  source: string; fromBlock: number; toBlock: number; totalEvents: number;
  agents: { agent: string; channelsFunded: number; funded: string; principalRepaid: string; revenueRouted: string; defaults: number }[];
  events: { name: string; text: string; block: number; tx: string; explorer: string; logIndex: number }[];
}

// The vault's history and each agent's record, rebuilt from events that Envio HyperSync returns in one query.
export function ActivityFeed() {
  const [data, setData] = useState<Activity | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    fetch("/api/activity", { cache: "no-store" })
      .then(async (r) => { const j = await r.json(); if (live) { if (r.ok) setData(j); else setError(true); } })
      .catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, []);

  // No token on this deployment, or HyperSync is unreachable: show nothing rather than a broken section.
  if (error || !data) return null;
  return (
    <section id="activity" className="flex scroll-mt-24 flex-col gap-5">
      <div className="flex flex-col gap-3">
        <p className="caption">Read live, not recorded</p>
        <h2 className="text-4xl">Every event the vault has <em>emitted</em></h2>
        <p className="max-w-3xl text-sm text-[var(--fg-muted)]">This feed and each agent&apos;s record are rebuilt on every visit from the vault&apos;s events, fetched from Envio HyperSync in one query.</p>
      </div>
      <p className="caption">{data.totalEvents} events · blocks {data.fromBlock} to {data.toBlock} · {data.source}</p>
      <div className="overflow-x-auto rounded-[var(--radius)] border-[1.5px] border-[var(--line)] bg-[var(--paper)]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b-[1.5px] border-[var(--line)]"><tr>{["Agent", "Channels funded", "Funded", "Principal repaid", "Revenue routed", "Defaults"].map((h) => <th key={h} className="caption px-4 py-3 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {data.agents.map((a) => (
              <tr key={a.agent} className="border-t border-dashed border-[var(--border)]">
                <td className="px-4 py-3 font-mono text-xs">{a.agent.slice(0, 8)}…{a.agent.slice(-6)}</td>
                <td className="px-4 py-3 font-mono">{a.channelsFunded}</td><td className="px-4 py-3 font-mono">{a.funded}</td>
                <td className="px-4 py-3 font-mono">{a.principalRepaid}</td><td className="px-4 py-3 font-mono">{a.revenueRouted}</td><td className="px-4 py-3 font-mono">{a.defaults}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ol className="grid rounded-[var(--radius)] border-[1.5px] border-[var(--line)] bg-[var(--paper)] px-5 py-2 text-sm">
        {data.events.map((e) => (
          <li key={`${e.tx}-${e.logIndex}`} className="grid grid-cols-[7.5rem_1fr] items-baseline gap-x-4 gap-y-1 border-t border-dashed border-[var(--border)] py-2.5 first:border-t-0 md:grid-cols-[7.5rem_1fr_auto]">
            <span className="font-mono text-xs text-[var(--accent-ink)]">{e.name}</span>
            <span>{e.text}</span>
            <a href={e.explorer} target="_blank" rel="noreferrer" className="link-rule font-mono text-xs text-[var(--fg-muted)] max-md:col-start-2">block {e.block}</a>
          </li>
        ))}
      </ol>
    </section>
  );
}
