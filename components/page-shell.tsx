import Link from "next/link";
import type { ReactNode } from "react";
import { Mark, SiteNav } from "@/components/site-nav";
import deployment from "@/.kit/deployment.json";

const short = (a: string) => `${a.slice(0, 8)}…${a.slice(-6)}`;

// The footer is the foot of the ledger sheet: where the vault lives on chain, then the plain status line.
export function SiteFooter() {
  const link = "link-rule decoration-[color-mix(in_srgb,var(--paper)_30%,transparent)]";
  const onChain = [
    { label: "Vault", addr: deployment.contractAddress, href: deployment.explorerContract },
    { label: "x402 settlement", addr: deployment.x402BatchSettlement, href: `https://testnet.monadscan.com/address/${deployment.x402BatchSettlement}` },
    { label: "Deployment tx", addr: deployment.txHash, href: deployment.explorerTx },
  ];
  return (
    <footer className="on-ink bg-[var(--navy)] text-[var(--paper)]">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 pb-10 pt-16 md:grid-cols-[1.1fr_1.4fr]">
        <div className="flex max-w-sm flex-col gap-4">
          <p className="flex items-center gap-2.5 font-[family-name:var(--font-display)] text-3xl leading-none"><Mark />Danom</p>
          <p className="text-sm text-[var(--surface-raised)]">Credit for AI agents on Monad. The agent signs, the vault pays, and revenue repays the loan first.</p>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-sm">
            <Link href="/" className={link}>Overview</Link>
            <Link href="/demo" className={link}>Credit flow</Link>
            <Link href="/proof" className={link}>Recorded run</Link>
          </nav>
        </div>
        <dl className="flex flex-col text-sm">
          {onChain.map((c) => (
            <div key={c.label} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-[color-mix(in_srgb,var(--paper)_18%,transparent)] py-3">
              <dt className="caption !text-[var(--border)]">{c.label}</dt>
              <dd><a href={c.href} target="_blank" rel="noreferrer" className={`font-mono ${link}`}>{short(c.addr)} ↗</a></dd>
            </div>
          ))}
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-[color-mix(in_srgb,var(--paper)_18%,transparent)] py-3">
            <dt className="caption !text-[var(--border)]">Status</dt>
            <dd className="max-w-sm text-right text-[var(--surface-raised)]">Testnet preview. Not audited. The token is a test token.</dd>
          </div>
        </dl>
      </div>
      <p className="caption mx-auto w-full max-w-6xl border-t border-[color-mix(in_srgb,var(--paper)_18%,transparent)] px-6 py-5 !text-[var(--border)]">Built for Monad Metropolis · chain {deployment.chainId}</p>
    </footer>
  );
}

// Shared page frame: skip link, nav bar, a ruled header band, content, footer.
export function PageShell({
  active, eyebrow, title, intro, children,
}: { active: string; eyebrow?: string; title: ReactNode; intro?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-30 focus:bg-[var(--navy)] focus:px-4 focus:py-2 focus:text-[var(--paper)]">Skip to content</a>
      <SiteNav active={active} />
      <header className="hero-wash">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-6 pb-12 pt-14">
          {eyebrow ? <p className="caption">{eyebrow}</p> : null}
          <h1 className="max-w-3xl text-5xl leading-[1.02] sm:text-7xl">{title}</h1>
          {intro ? <div className="flex max-w-2xl flex-col gap-3 text-lg text-[var(--fg-muted)]">{intro}</div> : null}
        </div>
      </header>
      <main id="main" className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-16 px-6 pb-24 pt-12">{children}</main>
      <SiteFooter />
    </div>
  );
}
