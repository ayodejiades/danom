import type { ReactNode } from "react";
import { SiteNav } from "@/components/site-nav";

export function SiteFooter() {
  return (
    <footer className="border-t-[1.5px] border-[var(--line)] bg-[var(--navy)]">
      <p className="mx-auto w-full max-w-6xl px-6 py-5 text-sm text-[var(--fg-muted)]">© 2026 Danom. All rights reserved.</p>
    </footer>
  );
}

// Shared page frame: skip link, nav bar, a ruled header band, content, footer.
export function PageShell({
  active, eyebrow, title, intro, children,
}: { active: string; eyebrow?: string; title: ReactNode; intro?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-30 focus:bg-[var(--navy)] focus:px-4 focus:py-2 focus:text-[var(--fg)]">Skip to content</a>
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
