import Link from "next/link";
import type { ReactNode } from "react";
import { SiteNav } from "@/components/site-nav";
import deployment from "@/.kit/deployment.json";

export function SiteFooter() {
  const col = "flex flex-col gap-3 text-sm";
  const link = "text-[var(--fg-muted)] transition-colors duration-300 hover:text-[var(--accent-ink)]";
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-14 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div className="flex max-w-xs flex-col gap-3">
          <p className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <span aria-hidden className="h-3 w-3 rounded-full bg-[var(--accent)] ring-4 ring-[var(--sky)]" />
            Danom
          </p>
          <p className="text-sm text-[var(--fg-muted)]">Credit for AI agents on Monad. The agent signs, the vault pays, and revenue repays the loan first.</p>
        </div>
        <nav aria-label="Product" className={col}>
          <p className="font-semibold">Product</p>
          <Link href="/" className={link}>Overview</Link>
          <Link href="/demo" className={link}>Try the credit flow</Link>
          <Link href="/proof" className={link}>Recorded run</Link>
        </nav>
        <nav aria-label="On chain" className={col}>
          <p className="font-semibold">On chain</p>
          <a href={deployment.explorerContract} className={link} target="_blank" rel="noreferrer">Vault on Monad testnet</a>
          <a href={`https://testnet.monadscan.com/address/${deployment.x402BatchSettlement}`} className={link} target="_blank" rel="noreferrer">x402 settlement contract</a>
          <a href={deployment.explorerTx} className={link} target="_blank" rel="noreferrer">Deployment transaction</a>
        </nav>
        <div className={col}>
          <p className="font-semibold">Status</p>
          <p className="text-[var(--fg-muted)]">Testnet preview. Contracts are not audited and the token is a test token.</p>
        </div>
      </div>
      <div className="border-t border-[var(--border)] px-6 py-5 text-center text-xs text-[var(--fg-muted)]">Built for Monad Metropolis.</div>
    </footer>
  );
}

// Shared page frame: skip link, floating nav, a sky-and-mint washed header band, content, footer.
export function PageShell({
  active, title, intro, children,
}: { active: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-30 focus:rounded-full focus:bg-[var(--navy)] focus:px-4 focus:py-2 focus:text-white">Skip to content</a>
      <SiteNav active={active} />
      <header className="hero-wash">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 pb-12 pt-14">
          <h1 className="max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">{title}</h1>
          {intro ? <div className="flex max-w-3xl flex-col gap-3 text-lg text-[var(--fg-muted)]">{intro}</div> : null}
        </div>
      </header>
      <main id="main" className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-16 px-6 py-12">{children}</main>
      <SiteFooter />
    </div>
  );
}
