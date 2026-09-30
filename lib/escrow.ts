export interface EscrowReceipt {
  id: string;
  payer: string;
  provider: string;
  amount: string;
  slaDeadlineMs: number;
  actualLatencyMs: number;
  schemaValid: boolean;
  status: "released" | "refunded" | "pending";
  timestamp: string;
}

export async function verifyAndSettleEscrow(
  provider: string,
  amount: string,
  slaMs: number,
  responseLatencyMs: number,
  payload: Record<string, unknown>
): Promise<EscrowReceipt> {
  const schemaValid = Boolean(payload && typeof payload === "object" && !("error" in payload));
  const withinSla = responseLatencyMs <= slaMs;
  const status = schemaValid && withinSla ? "released" : "refunded";

  return {
    id: `escrow-${Date.now().toString(36)}`,
    payer: "0xJudgeDemo...777",
    provider,
    amount,
    slaDeadlineMs: slaMs,
    actualLatencyMs: responseLatencyMs,
    schemaValid,
    status,
    timestamp: new Date().toISOString(),
  };
}
