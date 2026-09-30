// lib/stream.ts — pure logic shared by the UI, the tests and the local proof run.
// Everything here mirrors what the Solidity contracts enforce; the Foundry tests and
// tests/stream.test.mjs check both sides against the same numbers.
import { encodeAbiParameters, keccak256, parseAbiParameters, toBytes } from "viem";

export const AUSD_DECIMALS = 6;
const ZERO = BigInt(0);
const UNIT = BigInt(10 ** AUSD_DECIMALS);

/** Whole-dollar string or number -> AUSD base units (6 decimals). */
export function toUnits(amount: string | number): bigint {
  const [whole, frac = ""] = String(amount).split(".");
  const padded = (frac + "000000").slice(0, AUSD_DECIMALS);
  return BigInt(whole || "0") * UNIT + BigInt(padded || "0");
}

export function fromUnits(units: bigint, digits = 2): string {
  const negative = units < ZERO;
  const abs = negative ? -units : units;
  const whole = abs / UNIT;
  const frac = (abs % UNIT).toString().padStart(AUSD_DECIMALS, "0").slice(0, digits);
  return `${negative ? "-" : ""}${whole.toString()}${digits > 0 ? "." + frac : ""}`;
}

// ---------------------------------------------------------------- streams

export interface StreamTerms {
  deposit: bigint;
  start: number; // unix seconds
  end: number;
  withdrawn: bigint;
  cancelled?: boolean;
  accruedAtCancel?: bigint;
}

/** Same integer math as AusdStream.accrued(): floor(deposit * elapsed / duration). */
export function accruedAt(s: StreamTerms, now: number): bigint {
  if (s.cancelled) return s.accruedAtCancel ?? ZERO;
  if (now >= s.end) return s.deposit;
  if (now <= s.start) return ZERO;
  return (s.deposit * BigInt(now - s.start)) / BigInt(s.end - s.start);
}

export function withdrawableAt(s: StreamTerms, now: number): bigint {
  return accruedAt(s, now) - s.withdrawn;
}

/** What cancel() would pay each side at `now`. */
export function cancelSplit(s: StreamTerms, now: number) {
  const earned = accruedAt(s, now);
  return { toRecipient: earned - s.withdrawn, refundToSender: s.deposit - earned };
}

// --------------------------------------------------------------- corridors

export interface Corridor {
  id: string; // "US>NG"
  from: string;
  to: string;
  currency: string;
  /** Display-only reference rate, units of local currency per 1 USD. Not a live quote. */
  referenceRate: number;
  /** Typical bank wire fee and time, for the comparison line in the UI. Illustrative. */
  typicalWireFeePct: number;
  typicalWireDays: number;
}

export const CORRIDORS: Corridor[] = [
  { id: "US>NG", from: "United States", to: "Nigeria", currency: "NGN", referenceRate: 1500, typicalWireFeePct: 6.2, typicalWireDays: 3 },
  { id: "US>GH", from: "United States", to: "Ghana", currency: "GHS", referenceRate: 15, typicalWireFeePct: 7.1, typicalWireDays: 3 },
  { id: "US>KE", from: "United States", to: "Kenya", currency: "KES", referenceRate: 129, typicalWireFeePct: 6.8, typicalWireDays: 2 },
  { id: "US>PH", from: "United States", to: "Philippines", currency: "PHP", referenceRate: 57, typicalWireFeePct: 5.4, typicalWireDays: 2 },
  { id: "US>MX", from: "United States", to: "Mexico", currency: "MXN", referenceRate: 18.5, typicalWireFeePct: 4.6, typicalWireDays: 1 },
];

export function corridorHash(id: string): `0x${string}` {
  return keccak256(toBytes(id));
}

export function localAmount(units: bigint, c: Corridor): string {
  const usd = Number(units) / 10 ** AUSD_DECIMALS;
  return (usd * c.referenceRate).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

// ----------------------------------------------------------- agent policy

export interface AgentPolicy {
  perCallCap: bigint;
  dailyCap: bigint;
  active: boolean;
  allowedRecipients: string[];
}

export interface AgentLedger {
  spentToday: bigint;
  usedRefs: string[];
}

export type Refusal =
  | "PolicyInactive"
  | "ZeroAmount"
  | "RecipientNotAllowed"
  | "OverPerCallCap"
  | "OverDailyCap"
  | "RefAlreadyUsed";

export type Verdict = { ok: true; spentAfter: bigint } | { ok: false; reason: Refusal };

/** Same check order as AgentSpend.pay(), so the UI shows the revert the chain would give. */
export function checkAgentPayment(
  policy: AgentPolicy,
  ledger: AgentLedger,
  recipient: string,
  amount: bigint,
  ref: string,
): Verdict {
  if (!policy.active) return { ok: false, reason: "PolicyInactive" };
  if (amount === ZERO) return { ok: false, reason: "ZeroAmount" };
  if (!policy.allowedRecipients.some((a) => a.toLowerCase() === recipient.toLowerCase()))
    return { ok: false, reason: "RecipientNotAllowed" };
  if (amount > policy.perCallCap) return { ok: false, reason: "OverPerCallCap" };
  if (ledger.usedRefs.includes(ref)) return { ok: false, reason: "RefAlreadyUsed" };
  const spentAfter = ledger.spentToday + amount;
  if (spentAfter > policy.dailyCap) return { ok: false, reason: "OverDailyCap" };
  return { ok: true, spentAfter };
}

// ---------------------------------------------------------------- receipts

export interface ReceiptFields {
  chainId: number;
  contract: string;
  kind: string; // "borrowed" | "repaid" | "liquidated" | "supplied" ...
  id: string; // stream id or call ref
  from: string;
  to: string;
  amount: bigint;
  txHash: string;
}

/** Digest a person can recompute to check a receipt was not edited after the fact. */
export function receiptDigest(r: ReceiptFields): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters(
        "uint256 chainId, address contractAddr, string kind, string id, address from, address to, uint256 amount, bytes32 txHash",
      ),
      [
        BigInt(r.chainId),
        r.contract as `0x${string}`,
        r.kind,
        r.id,
        r.from as `0x${string}`,
        r.to as `0x${string}`,
        r.amount,
        r.txHash as `0x${string}`,
      ],
    ),
  );
}
