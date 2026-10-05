import Link from "next/link";

export function Nav({ project }: { project: string }) {
  return (
    <nav className="mx-4 mt-4 flex items-center justify-between rounded-[var(--radius-pill)] border border-[var(--border)] bg-white/85 px-5 py-3 shadow-[var(--shadow)] backdrop-blur">
      <Link href="/" className="font-semibold text-[var(--fg)]">
        {project}
      </Link>
      <div className="flex items-center gap-4 text-sm text-[var(--fg-muted)]">
        <Link href="/" className="hover:text-[var(--fg)]">
          Dashboard
        </Link>
      </div>
    </nav>
  );
}
