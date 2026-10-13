// app/api/vendor/gas/route.ts — a paid API. Unpaid requests get HTTP 402 with the price; a request that
// carries a voucher signed by a funded channel's payerAuthorizer gets the data. See lib/x402.ts.
import { createPublicClient, http } from "viem";
import { monadTestnet } from "viem/chains";
import { NextResponse } from "next/server";
import { handleVendorRequest, PAYMENT_HEADER, PAYMENT_REQUIRED_HEADER, PAYMENT_RESPONSE_HEADER, RPC_URL } from "@/lib/x402";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const pub = createPublicClient({ chain: monadTestnet, transport: http(process.env.RPC_URL || RPC_URL) });
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": `${PAYMENT_HEADER}, X-PAYMENT, content-type`,
  "access-control-expose-headers": `${PAYMENT_REQUIRED_HEADER}, ${PAYMENT_RESPONSE_HEADER}`,
  "cache-control": "no-store",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors });
}

export async function GET(request: Request) {
  const header = request.headers.get(PAYMENT_HEADER) ?? request.headers.get("X-PAYMENT");
  try {
    const reply = await handleVendorRequest(pub, header, new URL(request.url).origin + "/api/vendor/gas");
    return NextResponse.json(reply.body, { status: reply.status, headers: { ...cors, ...reply.headers } });
  } catch (e) {
    return NextResponse.json({ error: `The vendor could not reach Monad testnet: ${(e as Error).message.split("\n")[0]}` }, { status: 503, headers: cors });
  }
}
