import Link from "next/link";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/demo", label: "Try the credit flow" },
  { href: "/proof", label: "Recorded run" },
];

export function SiteNav({ active }: { active: string }) {
  return (
    <header className="border-b border-[var(--border)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
        <Link href="/" className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
          Agent Credit
          <span className="rounded border border-[var(--border)] px-2 py-0.5 font-mono text-xs font-normal text-[var(--fg-muted)]">Monad</span>
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-5 text-sm">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={l.href === active ? "text-[var(--fg)]" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"}>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
