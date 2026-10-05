import type { ReactNode } from "react";
import { SiteNav } from "@/components/site-nav";

export function SiteFooter() {
  return (
    <footer className="px-6 py-8 text-center text-sm text-[var(--fg-muted)]">
      Built for Monad Metropolis. Contracts are not audited.
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
