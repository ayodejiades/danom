import Link from "next/link";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/demo", label: "Credit flow" },
  { href: "/proof", label: "Recorded run" },
];

export function SiteNav({ active }: { active: string }) {
  return (
    <header className="sticky top-0 z-20 px-4 pt-4">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 rounded-[var(--radius-pill)] border border-[var(--border)] bg-white/85 py-2 pl-5 pr-2 shadow-[var(--shadow)] backdrop-blur">
        <Link href="/" className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <span aria-hidden className="h-3 w-3 rounded-full bg-[var(--accent)] ring-4 ring-[var(--sky)]" />
          Danom
          <span className="rounded-full bg-[var(--surface-raised)] px-2 py-0.5 font-mono text-xs font-medium text-[var(--accent-ink)]">Monad</span>
        </Link>
        <nav aria-label="Primary" className="flex flex-wrap items-center gap-1 text-sm font-semibold">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={l.href === active ? "page" : undefined}
              className={`rounded-full px-4 py-2 transition-colors duration-300 ${l.href === active ? "bg-[var(--navy)] text-white" : "text-[var(--fg-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--fg)]"}`}
            >
              {l.label}
            </Link>
          ))}
          {active !== "/demo" && (
            <Link href="/demo" className="ml-1 rounded-full bg-[var(--accent)] px-4 py-2 text-[var(--accent-contrast)] transition-colors duration-300 hover:bg-[var(--navy)] hover:text-white">
              Launch demo
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
