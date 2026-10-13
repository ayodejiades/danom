// app/api/vault/simulate/route.ts — asks the deployed vault, by simulation, whether it would fund a channel
// for the demo agent. Nothing is sent. The answer is the contract's own: a channel id or a revert name.
import { BaseError, ContractFunctionRevertedError, createPublicClient, http, isAddress, type Hex } from "viem";
import { monadTestnet } from "viem/chains";
import { NextResponse } from "next/server";
import { AGENT, CHANNEL_SALT, RPC_URL, SPONSOR, VAULT, VAULT_ABI, VENDOR, WITHDRAW_DELAY } from "@/lib/x402";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const pub = createPublicClient({ chain: monadTestnet, transport: http(process.env.RPC_URL || RPC_URL) });

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const to = q.get("to") ?? "vendor";
  const receiver = (to === "vendor" ? VENDOR : to === "self" ? AGENT : to) as Hex;
  const amount = Number(q.get("amount") ?? "10");
  if (!isAddress(receiver) || !Number.isFinite(amount) || amount < 0 || amount > 1e9) {
    return NextResponse.json({ error: "Pass to=vendor, to=self or an address, and a numeric amount" }, { status: 400 });
  }
  const base = { receiver, amount, asked: "CreditVault.fundChannel", from: AGENT, vault: VAULT };
  try {
    await pub.simulateContract({
      account: AGENT, address: VAULT, abi: VAULT_ABI, functionName: "fundChannel",
      args: [SPONSOR, receiver, WITHDRAW_DELAY, CHANNEL_SALT, BigInt(Math.round(amount * 1e6))],
    });
    return NextResponse.json({ ...base, allowed: true }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    let reason = "reverted";
    if (e instanceof BaseError) {
      const inner = e.walk((x) => x instanceof ContractFunctionRevertedError);
      if (inner instanceof ContractFunctionRevertedError) reason = inner.data?.errorName ?? inner.reason ?? reason;
    }
    return NextResponse.json({ ...base, allowed: false, revertedWith: reason }, { headers: { "cache-control": "no-store" } });
  }
}
