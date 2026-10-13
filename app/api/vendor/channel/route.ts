// app/api/vendor/channel/route.ts — read only: the demo channel's escrow and the agent's credit line, from chain.
import { createPublicClient, http } from "viem";
import { monadTestnet } from "viem/chains";
import { NextResponse } from "next/server";
import { AGENT, channelState, DEMO_CHANNEL, PRICE, RPC_URL, SPONSOR, VAULT, VAULT_ABI } from "@/lib/x402";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const pub = createPublicClient({ chain: monadTestnet, transport: http(process.env.RPC_URL || RPC_URL) });

export async function GET() {
  try {
    const read = <T,>(functionName: string) => pub.readContract({ address: VAULT, abi: VAULT_ABI, functionName, args: [SPONSOR, AGENT] }) as Promise<T>;
    const [ch, line, debt, limit] = await Promise.all([channelState(pub, DEMO_CHANNEL), read<readonly unknown[]>("lines"), read<bigint>("debtOf"), read<bigint>("creditLimit")]);
    return NextResponse.json({
      channelId: ch.channelId, escrow: (ch.balance - ch.totalClaimed).toString(), totalClaimed: ch.totalClaimed.toString(), price: PRICE.toString(),
      line: { active: Boolean(line[0]), perChannelCap: String(line[3]), debt: debt.toString(), creditLimit: limit.toString() },
    }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.split("\n")[0] }, { status: 503 });
  }
}
