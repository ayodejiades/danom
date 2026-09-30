"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_GROUPS = [
  {
    label: "Batch & Intent Operations",
    items: [
      { href: "/dashboard", label: "Cycle overview", badge: "LIVE" },
      { href: "/dashboard/create", label: "Submit intent", badge: "NEW" },
      { href: "/dashboard/items", label: "Settled batches", badge: "15" },
    ],
  },
  {
    label: "Solver Assurance",
    items: [
      { href: "/dashboard/operator", label: "Solver authority", badge: "GATE" },
      { href: "/dashboard/sponsors", label: "Sponsor seams", badge: "4 SEAMS" },
      { href: "/lab", label: "Policy invariants", badge: "15 RULES" },
    ],
  },
  {
    label: "Attestation & Ledger",
    items: [
      { href: "/proof", label: "Claim & invariant ledger", badge: "PASS" },
      { href: "/verify", label: "Contract verifier", badge: "EVM" },
      { href: "/demo", label: "Interactive replay", badge: "DEMO" },
    ],
  },
];

export function DashboardShell({
  project,
  children,
}: {
  project?: string;
  children: ReactNode;
}) {
  const pathname = usePathname() || "/dashboard";
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      } else if (e.key === "Escape") {
        setCmdOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#171717] antialiased">
      {/* Top Header */}
      <header className="border-b border-[#e5e5e5] bg-white px-4 py-2.5">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="inline-flex items-center gap-2">
              <span className="relative inline-grid h-3.5 w-3.5 place-items-center" aria-hidden>
                <span className="absolute inset-0 rounded-full border border-[#2563eb]/40" />
                <span className="h-1.5 w-1.5 rounded-full bg-[#2563eb]" />
              </span>
              <span className="text-[14px] font-semibold tracking-[-0.01em] text-[#0a0a0a]">
                {project || "Protocol Console"}
              </span>
            </Link>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#bbf7d0] bg-[#dcfce7] px-2.5 py-0.5 font-mono text-[11px] font-medium text-[#166534]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#16a34a]" />
              Solver Active · Invariants Verified
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              className="inline-flex items-center gap-2 rounded-[8px] border border-[#e5e5e5] bg-[#f5f5f5] px-2.5 py-1 text-[12px] font-medium text-[#404040] hover:bg-[#e5e5e5]/60"
            >
              <span>Quick jump</span>
              <kbd className="rounded border border-[#d4d4d4] bg-white px-1.5 py-0.5 font-mono text-[10px] text-[#525252]">
                ⌘K
              </kbd>
            </button>
            <Link
              href="/proof"
              className="rounded-[8px] border border-[#e5e5e5] bg-white px-3 py-1 text-[12px] font-medium text-[#171717] hover:bg-[#f5f5f5]"
            >
              Proof Ledger
            </Link>
            <Link
              href="/verify"
              className="rounded-[8px] bg-black px-3 py-1 text-[12px] font-medium text-white hover:bg-[#171717]"
            >
              Verify Contracts
            </Link>
          </div>
        </div>
      </header>

      {/* 2-Column Sticky Operator Layout */}
      <div className="mx-auto flex max-w-[1480px] gap-4 p-3 lg:gap-5 lg:p-5">
        <aside className="sticky top-5 hidden h-[calc(100vh-4.5rem)] w-[248px] shrink-0 flex-col justify-between rounded-2xl border border-[#e5e5e5] bg-white px-4 py-5 shadow-[rgba(0,0,0,0.05)_0px_1px_2px_0px] lg:flex">
          <div className="space-y-5 overflow-y-auto">
            {NAV_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="px-2 pb-1.5 font-mono text-[10px] tracking-[0.1em] text-[#737373] uppercase">
                  {group.label}
                </p>
                <div className="flex flex-col gap-0.5">
                  {group.items.map((item) => {
                    const active = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center justify-between rounded-[8px] px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                          active
                            ? "bg-[#dbeafe] text-[#1e40af]"
                            : "text-[#404040] hover:bg-[#f5f5f5] hover:text-[#171717]"
                        }`}
                      >
                        <span className="truncate">{item.label}</span>
                        <span
                          className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full border ${
                            active
                              ? "border-[#bfdbfe] bg-white text-[#1e40af]"
                              : "border-[#e5e5e5] bg-[#f5f5f5] text-[#525252]"
                          }`}
                        >
                          {item.badge}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-[#e5e5e5] bg-[#f5f5f5] p-3 text-[11px] text-[#525252] space-y-1">
            <div className="flex items-center justify-between font-mono text-[10px] text-[#171717]">
              <span>SOLVER INVARIANT</span>
              <span className="text-[#16a34a] font-semibold">ZERO SLIPPAGE</span>
            </div>
            <p className="leading-snug">
              CoW batch auction clears ring trades at uniform prices. Non-custodial escrow guarantees fund safety.
            </p>
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {/* ⌘K Command Modal */}
      {cmdOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-20 px-4"
          onClick={() => setCmdOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-[#d4d4d4] bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-3 mb-3">
              <span className="text-[13px] font-semibold text-[#171717]">
                Quick Jump Navigation
              </span>
              <button
                type="button"
                onClick={() => setCmdOpen(false)}
                className="font-mono text-[11px] text-[#737373] hover:text-[#171717]"
              >
                ESC
              </button>
            </div>
            <div className="grid gap-1 max-h-80 overflow-y-auto">
              {NAV_GROUPS.flatMap((g) => g.items).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setCmdOpen(false)}
                  className="flex items-center justify-between rounded-[8px] px-3 py-2 text-[13px] text-[#171717] hover:bg-[#f5f5f5]"
                >
                  <span>{item.label}</span>
                  <span className="font-mono text-[11px] text-[#2563eb]">{item.href}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
