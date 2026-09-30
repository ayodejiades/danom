"use client";

/**
 * Self-walking Hero Console Tour + Interactive 3-Mode Multi-Party Cycle Crossing Graph
 * + 3-Seat "Who This Is For" Protocol Role Strip.
 *
 * Uses the Editorial Light Fintech Design System (#ffffff paper, #f5f5f5 canvas,
 * 1px #e5e5e5 hairlines, weight-500 display type, tabular numerals, semantic refusal red).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DEMO_INTENTS, POLICY_RULES, runBatchSolver } from "@/lib/solver";
import { SPONSORS } from "@/lib/sponsors";

const DWELL_MS = 5200;

type GraphMode = "MARKET_ONLY" | "PAIRWISE_ONLY" | "FULL_SOLVER";

export function ConsoleTour() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [graphMode, setGraphMode] = useState<GraphMode>("FULL_SOLVER");
  const [replayTick, setReplayTick] = useState(0);
  const frameRef = useRef<HTMLDivElement | null>(null);

  const batchResult = runBatchSolver(DEMO_INTENTS, 2500);

  const stops = [
    { id: "cycle", label: "Cycle crossing", tone: "blue" as const },
    { id: "solver", label: "6-venue split", tone: "green" as const },
    { id: "policy", label: "15-rule policy", tone: "blue" as const },
    { id: "sponsors", label: "Sponsor rails", tone: "orange" as const },
    { id: "receipt", label: "Signed receipt", tone: "green" as const },
  ];

  useEffect(() => {
    const node = frameRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.25 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (paused || !visible) return;
    const timer = window.setTimeout(
      () => setActive((curr) => (curr + 1) % stops.length),
      DWELL_MS
    );
    return () => window.clearTimeout(timer);
  }, [paused, visible, active, stops.length]);

  const selectStop = useCallback((idx: number) => {
    setActive(idx);
  }, []);

  return (
    <section className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 space-y-10 text-[#171717]">
      {/* Live Verifier Stamp Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#e5e5e5] bg-white px-3.5 py-1.5 shadow-[rgba(0,0,0,0.04)_0px_1px_2px_0px]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#16a34a]" />
          <span className="font-mono text-[11px] font-medium uppercase text-[#1e40af] tabular-nums">
            round g2-cycle · {batchResult.cowRatioPct}% peer crossed · +{batchResult.savingsBpsVsSingleAmm} bps edge · verifier PASS
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="rounded-[8px] border border-[#e5e5e5] bg-white px-3 py-1.5 text-[12px] font-medium text-[#404040] hover:bg-[#f5f5f5]"
          >
            {paused ? "Resume tour" : "Hold screen"}
          </button>
          <Link
            href="/verify"
            className="rounded-[8px] bg-black px-3.5 py-1.5 text-[12px] font-medium text-white hover:bg-[#171717]"
          >
            Verify the receipt →
          </Link>
        </div>
      </div>

      {/* Walked Hero Console Frame */}
      <div
        ref={frameRef}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        className="overflow-hidden rounded-[16px] border border-[#d4d4d4] bg-white shadow-[0_12px_36px_rgba(10,10,10,0.06)]"
      >
        {/* Top Console Rail */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5e5e5] bg-[#f5f5f5] px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-1">
            {stops.map((stop, idx) => {
              const isCurrent = idx === active;
              const dotClass =
                stop.tone === "green"
                  ? "bg-[#16a34a]"
                  : stop.tone === "orange"
                  ? "bg-[#ea580c]"
                  : "bg-[#2563eb]";
              return (
                <button
                  key={stop.id}
                  type="button"
                  data-demo={`tour-stop-${stop.id}`}
                  onClick={() => selectStop(idx)}
                  className={`inline-flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[12px] font-medium transition-colors ${
                    isCurrent
                      ? "bg-white text-[#171717] border border-[#d4d4d4] shadow-[rgba(0,0,0,0.04)_0px_1px_2px_0px]"
                      : "text-[#525252] hover:text-[#171717] hover:bg-white/60 border border-transparent"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${isCurrent ? dotClass : "bg-[#a3a3a3]"}`} />
                  <span>{stop.label}</span>
                </button>
              );
            })}
          </div>
          <span className="font-mono text-[11px] text-[#737373] hidden md:inline">
            Replay of verified round · Hover to hold a screen, or click any step
          </span>
        </div>

        {/* Active Tour Panel Body */}
        <div className="p-5 sm:p-6 min-h-[360px] flex flex-col justify-between bg-white">
          {active === 0 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#2563eb]">
                    Multi-party cycle discovery
                  </p>
                  <h3 className="mt-1 text-[18px] font-medium tracking-[-0.02em] text-[#171717]">
                    Portfolios cross complementary intents peer-to-peer before sending only the residual to AMMs
                  </h3>
                </div>
                <div className="flex items-center gap-1.5">
                  {(["MARKET_ONLY", "PAIRWISE_ONLY", "FULL_SOLVER"] as GraphMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setGraphMode(m);
                        setReplayTick((t) => t + 1);
                      }}
                      className={`rounded-[8px] border px-2.5 py-1 font-mono text-[11px] font-medium transition-colors ${
                        graphMode === m
                          ? "border-black bg-black text-white"
                          : "border-[#e5e5e5] bg-white text-[#404040] hover:bg-[#f5f5f5]"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setReplayTick((t) => t + 1)}
                    className="rounded-[8px] border border-[#e5e5e5] bg-[#f5f5f5] px-2.5 py-1 font-mono text-[11px] text-[#171717] hover:bg-[#e5e5e5]"
                  >
                    ↻ Replay
                  </button>
                </div>
              </div>

              <div key={replayTick} className="rounded-[12px] border border-[#e5e5e5] bg-[#fafafa] p-4">
                <svg viewBox="0 0 830 210" className="w-full h-auto">
                  {graphMode === "FULL_SOLVER" && (
                    <>
                      <path d="M 195 55 Q 290 20 380 55" fill="none" stroke="#2563eb" strokeWidth="2.2" />
                      <text x="240" y="28" fill="#1e40af" fontSize="10" fontFamily="monospace">
                        Internal cycle cross $170k (0 bps impact)
                      </text>
                      <path d="M 380 92 Q 285 148 195 152" fill="none" stroke="#2563eb" strokeWidth="2.2" />
                      <path d="M 115 130 L 115 86" fill="none" stroke="#2563eb" strokeWidth="2.2" />
                      <path d="M 545 72 L 625 100" fill="none" stroke="#737373" strokeWidth="1.5" strokeDasharray="4 4" />
                      <text x="548" y="62" fill="#525252" fontSize="10" fontFamily="monospace">
                        32% residual
                      </text>
                    </>
                  )}
                  {graphMode === "PAIRWISE_ONLY" && (
                    <>
                      <path d="M 195 60 L 380 60" fill="none" stroke="#2563eb" strokeWidth="2" />
                      <path d="M 195 155 L 625 120" fill="none" stroke="#ea580c" strokeWidth="1.8" strokeDasharray="4 4" />
                      <path d="M 545 72 L 625 100" fill="none" stroke="#ea580c" strokeWidth="1.8" strokeDasharray="4 4" />
                    </>
                  )}
                  {graphMode === "MARKET_ONLY" && (
                    <>
                      <path d="M 195 60 L 625 90" fill="none" stroke="#dc2626" strokeWidth="1.8" strokeDasharray="4 4" />
                      <path d="M 545 70 L 625 105" fill="none" stroke="#dc2626" strokeWidth="1.8" strokeDasharray="4 4" />
                      <path d="M 195 160 L 625 125" fill="none" stroke="#dc2626" strokeWidth="1.8" strokeDasharray="4 4" />
                      <text x="310" y="118" fill="#991b1b" fontSize="11" fontFamily="monospace">
                        Every wallet crosses the public spread alone (-69.8 bps)
                      </text>
                    </>
                  )}

                  <g transform="translate(25, 28)">
                    <rect width="170" height="58" rx="10" fill="#ffffff" stroke="#d4d4d4" strokeWidth="1.5" />
                    <text x="12" y="22" fill="#2563eb" fontSize="10" fontFamily="monospace">PORTFOLIO A · 0x7F2c</text>
                    <text x="12" y="42" fill="#171717" fontSize="12" fontWeight="600">Sells $150k USDC → WETH</text>
                  </g>

                  <g transform="translate(380, 32)">
                    <rect width="165" height="58" rx="10" fill="#ffffff" stroke="#d4d4d4" strokeWidth="1.5" />
                    <text x="12" y="22" fill="#166534" fontSize="10" fontFamily="monospace">PORTFOLIO B · 0x41B0</text>
                    <text x="12" y="42" fill="#171717" fontSize="12" fontWeight="600">Sells $110k WETH → USDC</text>
                  </g>

                  <g transform="translate(25, 130)">
                    <rect width="170" height="58" rx="10" fill="#ffffff" stroke="#d4d4d4" strokeWidth="1.5" />
                    <text x="12" y="22" fill="#9a3412" fontSize="10" fontFamily="monospace">PORTFOLIO C · 0x99A1</text>
                    <text x="12" y="42" fill="#171717" fontSize="12" fontWeight="600">Ring leg $60k cross</text>
                  </g>

                  <g transform="translate(625, 50)">
                    <rect
                      width="185"
                      height="110"
                      rx="12"
                      fill="#ffffff"
                      stroke={graphMode === "FULL_SOLVER" ? "#16a34a" : "#dc2626"}
                      strokeWidth="1.5"
                    />
                    <text x="14" y="24" fill="#525252" fontSize="10" fontFamily="monospace">PUBLIC LIQUIDITY RAILS</text>
                    <text x="14" y="45" fill="#171717" fontSize="12" fontWeight="600">
                      {graphMode === "FULL_SOLVER"
                        ? "68.0% internal cross"
                        : graphMode === "PAIRWISE_ONLY"
                        ? "44.0% pairwise cross"
                        : "0.0% internal cross"}
                    </text>
                    <text x="14" y="66" fill="#166534" fontSize="11" fontFamily="monospace">
                      {graphMode === "FULL_SOLVER"
                        ? "Impact: 12.4 bps (+57.4 bps)"
                        : graphMode === "PAIRWISE_ONLY"
                        ? "Impact: 31.0 bps"
                        : "Impact: 69.8 bps"}
                    </text>
                    <text x="14" y="86" fill="#737373" fontSize="10" fontFamily="monospace">
                      Uniswap v4 · Aerodrome · Curve
                    </text>
                  </g>
                </svg>
              </div>
            </div>
          )}

          {active === 1 && (
            <div className="space-y-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#2563eb]">
                    Residual routing & conservation
                  </p>
                  <h3 className="mt-1 text-[18px] font-medium tracking-[-0.02em] text-[#171717]">
                    Unmatched residual splits across six venues scored by net output after gas
                  </h3>
                </div>
                <Link href="/dashboard" className="text-[13px] font-medium text-[#2563eb] hover:underline">
                  Open solver console →
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 overflow-hidden rounded-[12px] border border-[#e5e5e5] bg-white">
                {[
                  { label: "Gross volume", val: `$${batchResult.grossVolumeUSDC.toLocaleString()}`, sub: "4 signed intents" },
                  { label: "Peer crossed", val: `${batchResult.cowRatioPct}%`, sub: "0 bps pool impact" },
                  { label: "Residual routed", val: `$${batchResult.residualUSDC.toLocaleString()}`, sub: "Across 6 venues" },
                  { label: "Execution edge", val: `+${batchResult.savingsBpsVsSingleAmm} bps`, sub: "vs single AMM" },
                ].map((m) => (
                  <div key={m.label} className="border-r border-[#e5e5e5] last:border-r-0 p-4">
                    <div className="text-[12px] text-[#525252]">{m.label}</div>
                    <div className="mt-1 font-mono text-[22px] font-semibold text-[#171717] tabular-nums">{m.val}</div>
                    <div className="mt-0.5 font-mono text-[11px] text-[#737373]">{m.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {active === 2 && (
            <div className="space-y-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#2563eb]">
                    Pre-settlement policy engine
                  </p>
                  <h3 className="mt-1 text-[18px] font-medium tracking-[-0.02em] text-[#171717]">
                    Fifteen deterministic rules checked before atomic escrow settlement
                  </h3>
                </div>
                <Link href="/dashboard/operator" className="text-[13px] font-medium text-[#2563eb] hover:underline">
                  Inspect all 15 rules →
                </Link>
              </div>
              <div className="grid gap-0 overflow-hidden rounded-[12px] border border-[#e5e5e5] sm:grid-cols-5 bg-white">
                {POLICY_RULES.slice(0, 5).map((rule) => (
                  <div key={rule.id} className="border-r border-[#e5e5e5] last:border-r-0 p-4">
                    <span className="font-mono text-[11px] font-semibold text-[#2563eb]">{rule.id}</span>
                    <div className="mt-1 text-[13px] font-semibold text-[#171717]">{rule.name}</div>
                    <p className="mt-1 text-[12px] text-[#525252]">{rule.check}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {active === 3 && (
            <div className="space-y-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#2563eb]">
                    Sponsor rail ablation
                  </p>
                  <h3 className="mt-1 text-[18px] font-medium tracking-[-0.02em] text-[#171717]">
                    Measured basis-point cost when any protocol sponsor rail is removed
                  </h3>
                </div>
                <Link href="/dashboard/sponsors" className="text-[13px] font-medium text-[#2563eb] hover:underline">
                  Open kill-switch simulator →
                </Link>
              </div>
              <div className="grid gap-0 overflow-hidden rounded-[12px] border border-[#e5e5e5] sm:grid-cols-2 lg:grid-cols-4 bg-white">
                {SPONSORS.map((sp) => (
                  <div key={sp.id} className="border-r border-[#e5e5e5] last:border-r-0 p-4 space-y-2">
                    <div className="flex items-center justify-between font-mono text-[10px]">
                      <span className="text-[#2563eb]">{sp.seam}</span>
                      <span className="rounded-full bg-[#dcfce7] px-2 py-0.5 text-[#166534]">LIVE</span>
                    </div>
                    <div className="text-[14px] font-semibold text-[#171717]">{sp.name}</div>
                    <div className="font-mono text-[11px] text-[#166534]">Full: {sp.ablation.fullSystemMetric}</div>
                    <div className="font-mono text-[11px] text-[#9a3412]">Ablated: {sp.ablation.removedMetric}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {active === 4 && (
            <div className="space-y-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#2563eb]">
                    Independent verification
                  </p>
                  <h3 className="mt-1 text-[18px] font-medium tracking-[-0.02em] text-[#171717]">
                    Check the receipt without trusting the coordinator — offline or in `/verify`
                  </h3>
                </div>
                <Link href="/verify" className="text-[13px] font-medium text-[#2563eb] hover:underline">
                  Open byte verifier →
                </Link>
              </div>
              <pre className="overflow-x-auto rounded-[8px] border border-[#e5e5e5] bg-[#f5f5f5] p-4 font-mono text-[12px] leading-relaxed text-[#171717]">{`$ pnpm claim:verify
[PASS] 15/15 pre-settlement policy rules verified · +57.4 bps execution edge
[PASS] 0 wei coordinator custody · Ed25519 signature valid · RESULT: VERIFIED (Exit 0)`}</pre>
            </div>
          )}

          <div className="mt-6 pt-3 border-t border-[#e5e5e5] flex flex-wrap items-center justify-between gap-2 text-[12px] text-[#737373]">
            <span>
              Self-custodial EIP-712 intents. Coordinator never holds custody. Unsafe slippage is refused before settlement.
            </span>
            <div className="flex items-center gap-4 font-medium text-[#2563eb]">
              <Link href="/demo" className="hover:underline">Round replay (/demo) →</Link>
              <Link href="/proof" className="hover:underline">Proof (/proof) →</Link>
              <Link href="/verify" className="hover:underline">Byte verifier (/verify) →</Link>
            </div>
          </div>
        </div>
      </div>

      {/* Who This Is For — 3-Seat Hairline Grid */}
      <div className="space-y-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#2563eb]">
            Who this is for
          </p>
          <h2 className="mt-1 text-[24px] font-medium tracking-[-0.02em] text-[#171717]">
            Three participants touch a settlement round, and none of them trusts the coordinator
          </h2>
        </div>

        <div className="grid gap-0 overflow-hidden rounded-[12px] border border-[#e5e5e5] bg-white sm:grid-cols-3">
          {[
            {
              when: "Rebalancing a multi-asset book",
              role: "The portfolio manager",
              body: "Signs an EIP-712 intent with explicit slippage and expiry limits. Complementary legs cross peer-to-peer at midpoint before touching public liquidity.",
              href: "/dashboard/create",
              cta: "Sign an intent",
            },
            {
              when: "Inside the batch auction",
              role: "The cycle solver & policy gate",
              body: "Discovers 3-way offsetting cycles and routes residuals across six venues, while the settlement contract enforces all fifteen conservation and oracle rules.",
              href: "/dashboard/operator",
              cta: "See policy boundaries",
            },
            {
              when: "Weeks later, offline",
              role: "The independent auditor",
              body: "Downloads the Ed25519-signed settlement receipt and recomputes every leg offline. Mutating a single byte in /verify triggers an immediate mismatch.",
              href: "/verify",
              cta: "Verify a receipt",
            },
          ].map((seat) => (
            <div
              key={seat.role}
              className="border-r border-b sm:border-b-0 border-[#e5e5e5] last:border-r-0 p-5 flex flex-col justify-between bg-white"
            >
              <div>
                <p className="font-mono text-[11px] tracking-[0.08em] text-[#2563eb] uppercase">
                  {seat.when}
                </p>
                <h3 className="mt-1.5 text-[15px] font-semibold text-[#171717]">{seat.role}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[#525252]">{seat.body}</p>
              </div>
              <Link
                href={seat.href}
                className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-[#2563eb] hover:underline"
              >
                {seat.cta} <span aria-hidden>→</span>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
