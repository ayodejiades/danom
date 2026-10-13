import Link from "next/link";
import { ConnectWallet } from "@/components/connect-wallet";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/demo", label: "Credit flow" },
  { href: "/proof", label: "Recorded run" },
];

// The mark is a wax-seal style monogram: a ring with the vault's initial.
export function Mark() {
  return (
    <span aria-hidden className="grid h-7 w-7 place-items-center rounded-full border-[1.5px] border-current font-[family-name:var(--font-display)] text-base italic leading-none">
      <span className="-translate-y-px">d</span>
    </span>
  );
}

export function SiteNav({ active }: { active: string }) {
  return (
    <header className="sticky top-0 z-20 border-b-[1.5px] border-[var(--fg)] bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2.5 sm:px-6">
        <Link href="/" className="order-1 flex items-center gap-2.5 font-[family-name:var(--font-display)] text-2xl leading-none tracking-tight">
          <Mark />
          Danom
          <span className="caption hidden border-l border-[var(--border)] pl-2.5 sm:inline">Monad testnet</span>
        </Link>
        <div className="order-2 sm:order-3"><ConnectWallet /></div>
        <nav aria-label="Primary" className="order-3 flex w-full items-center gap-5 text-sm font-medium sm:order-2 sm:ml-auto sm:w-auto sm:gap-7">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={l.href === active ? "page" : undefined}
              className={`relative py-1.5 transition-colors duration-200 after:absolute after:inset-x-0 after:-bottom-px after:h-[2px] after:origin-left after:bg-[var(--accent)] after:transition-transform after:duration-300 ${l.href === active ? "text-[var(--fg)] after:scale-x-100" : "text-[var(--fg-muted)] after:scale-x-0 hover:text-[var(--fg)] hover:after:scale-x-100"}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
