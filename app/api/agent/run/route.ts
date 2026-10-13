// app/api/agent/run/route.ts — runs the model-driven agent for one task and returns its transcript.
import { createPublicClient, http, type PublicClient } from "viem";
import { monadTestnet } from "viem/chains";
import { NextResponse } from "next/server";
import { runLlmAgent } from "@/lib/agent-llm";
import { RPC_URL } from "@/lib/x402";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const pub = createPublicClient({ chain: monadTestnet, transport: http(process.env.RPC_URL || RPC_URL) }) as PublicClient;

// A small per-address limit, because each run spends the deployment's model credit.
const seen = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (seen.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  seen.set(ip, recent);
  return recent.length > 4;
}

export async function POST(request: Request) {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No model key is configured on this deployment, so the agent cannot think here. The recorded run below shows one." }, { status: 503 });
  if (limited(request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local")) return NextResponse.json({ error: "Too many runs from this address. Try again in a minute." }, { status: 429 });
  let task = "";
  try { task = String((await request.json()).task ?? "").trim().slice(0, 500); } catch {}
  if (task.length < 4) return NextResponse.json({ error: "Give the agent a task." }, { status: 400 });
  try {
    const run = await runLlmAgent({ task, pub, vendorUrl: new URL(request.url).origin + "/api/vendor/gas", apiKey, baseUrl: process.env.LLM_BASE_URL, model: process.env.LLM_MODEL });
    return NextResponse.json(run, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.split("\n")[0] }, { status: 502 });
  }
}
