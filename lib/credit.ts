// lib/credit.ts — TypeScript mirror of CreditVault.sol. The UI uses it to show, before anything is
// sent, exactly which check the contract would refuse on. tests/credit.test.mjs pins it to the
// numbers in the Foundry tests and to the run recorded in PROOF_RUNS.json.
export const BPS = BigInt(10000);
const YEAR = BigInt(365 * 24 * 3600);
const ZERO = BigInt(0);
const U = (n: number) => BigInt(n) * BigInt(1_000_000);

export const TIER_THRESHOLDS = [ZERO, U(100), U(500), U(2000)] as const; // lifetime repaid principal
export const TIER_LTV_BPS = [7500, 10000, 15000, 25000] as const;
export const LIQUIDATION_BUFFER_BPS = BigInt(1500);
export const MIN_REPAY_SHARE_BPS = 1000;

export interface AgentRecord {
  repaidPrincipal: bigint;
  revenueRouted: bigint;
  defaults: number;
}

export function tierOf(r: AgentRecord): 0 | 1 | 2 | 3 {
  if (r.defaults > 0) return 0;
  if (r.repaidPrincipal >= TIER_THRESHOLDS[3]) return 3;
  if (r.repaidPrincipal >= TIER_THRESHOLDS[2]) return 2;
  if (r.repaidPrincipal >= TIER_THRESHOLDS[1]) return 1;
  return 0;
}

/** Credit supported per unit of collateral, in basis points: 75% / 100% / 150% / 250%. */
export function ltvBpsOf(r: AgentRecord): number {
  return TIER_LTV_BPS[tierOf(r)];
}

export interface CreditLine {
  active: boolean;
  collateral: bigint;
  baseLimit: bigint;
  perBorrowCap: bigint;
  principal: bigint; // includes escrow committed to channels and not yet returned
  interestOwed: bigint;
  aprBps: number;
  repayShareBps: number;
  lastAccrual: number; // unix seconds
  dueAt: number;
  allowedReceivers: string[];
}

export function pendingInterest(l: CreditLine, now: number): bigint {
  if (l.principal === ZERO || now <= l.lastAccrual) return ZERO;
  return (l.principal * BigInt(l.aprBps) * BigInt(now - l.lastAccrual)) / (BPS * YEAR);
}

export function debtAt(l: CreditLine, now: number): bigint {
  return l.principal + l.interestOwed + pendingInterest(l, now);
}

/** Ceiling on total debt: base limit plus lifetime repaid principal, never above what collateral supports at the tier. */
export function creditLimit(l: CreditLine, r: AgentRecord): bigint {
  const hardCap = (l.collateral * BigInt(ltvBpsOf(r))) / BPS;
  const earned = l.baseLimit + r.repaidPrincipal;
  return earned < hardCap ? earned : hardCap;
}

export type FundRefusal =
  | "LineInactive"
  | "LineExpired"
  | "ZeroAmount"
  | "ReceiverNotAllowed"
  | "OverPerBorrowCap"
  | "OverCreditLimit"
  | "InsufficientCash";

export type FundVerdict = { ok: true; debtAfter: bigint; limit: bigint } | { ok: false; reason: FundRefusal };

/** Same check order as CreditVault.fundChannel(). */
export function checkFunding(l: CreditLine, r: AgentRecord, receiver: string, amount: bigint, now: number, poolCash: bigint): FundVerdict {
  if (!l.active) return { ok: false, reason: "LineInactive" };
  if (now >= l.dueAt) return { ok: false, reason: "LineExpired" };
  if (amount === ZERO) return { ok: false, reason: "ZeroAmount" };
  if (!l.allowedReceivers.some((a) => a.toLowerCase() === receiver.toLowerCase())) return { ok: false, reason: "ReceiverNotAllowed" };
  if (amount > l.perBorrowCap) return { ok: false, reason: "OverPerBorrowCap" };
  const debtAfter = l.principal + l.interestOwed + pendingInterest(l, now) + amount;
  const limit = creditLimit(l, r);
  if (debtAfter > limit) return { ok: false, reason: "OverCreditLimit" };
  if (amount > poolCash) return { ok: false, reason: "InsufficientCash" };
  return { ok: true, debtAfter, limit };
}

/** Interest first, then principal, capped at what is owed. */
export function splitRepayment(l: CreditLine, amount: bigint, now: number) {
  const interest = l.interestOwed + pendingInterest(l, now);
  const interestPaid = amount < interest ? amount : interest;
  let principalPaid = amount - interestPaid;
  if (principalPaid > l.principal) principalPaid = l.principal;
  return { interestPaid, principalPaid, interestLeft: interest - interestPaid, principalLeft: l.principal - principalPaid };
}

/** A customer pays the agent through the vault: the line's repay share (or all the debt, if less) goes to the loan first. */
export function routeRevenue(l: CreditLine, amount: bigint, now: number) {
  const share = (amount * BigInt(l.repayShareBps)) / BPS;
  const { interestPaid, principalPaid } = splitRepayment(l, share, now);
  const toDebt = interestPaid + principalPaid;
  return { toDebt, toAgent: amount - toDebt, principalPaid, interestPaid };
}

export function isLiquidatable(l: CreditLine, r: AgentRecord, now: number): { liquidatable: boolean; why: "overdue" | "undercollateralized" | "healthy" } {
  const debt = l.principal + l.interestOwed + pendingInterest(l, now);
  if (debt === ZERO) return { liquidatable: false, why: "healthy" };
  if (now > l.dueAt) return { liquidatable: true, why: "overdue" };
  if (debt * BPS > l.collateral * (BigInt(ltvBpsOf(r)) + LIQUIDATION_BUFFER_BPS)) return { liquidatable: true, why: "undercollateralized" };
  return { liquidatable: false, why: "healthy" };
}
