/**
 * tools/ask.ts — give the model-driven agent a task from the terminal.
 *
 *   pnpm agent:ask "Is now a cheap time to send a transaction on Monad testnet?"
 *
 * Needs LLM_API_KEY, LLM_BASE_URL and LLM_MODEL in .env: any OpenAI-compatible chat API with tool calling,
 * for example a local Ollama model or a hosted Qwen. The agent
 * calls the deployed paid endpoint unless VENDOR_URL says otherwise. Writes the transcript to AGENT_LLM_RUN.json.
 */
import fs from "node:fs";
import path from "node:path";
import { createPublicClient, http, type PublicClient } from "viem";
import { monadTestnet } from "viem/chains";
import { runLlmAgent } from "../lib/agent-llm";
import { RPC_URL } from "../lib/x402";

const root = process.cwd();
if (fs.existsSync(path.join(root, ".env"))) {
  for (const line of fs.readFileSync(path.join(root, ".env"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const task = process.argv.slice(2).filter((a) => !a.startsWith("--")).join(" ").trim() || "Is now a cheap time to send a transaction on Monad testnet? Buy what you need to answer.";
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) throw new Error("LLM_API_KEY is not set in .env");
  const pub = createPublicClient({ chain: monadTestnet, transport: http(process.env.RPC_URL || RPC_URL) }) as PublicClient;
  const vendorUrl = process.env.VENDOR_URL || "https://danom-new.vercel.app/api/vendor/gas";
  const run = await runLlmAgent({ task, pub, vendorUrl, apiKey, baseUrl: process.env.LLM_BASE_URL, model: process.env.LLM_MODEL });
  console.log(`model ${run.model}\ntask  ${run.task}\n`);
  for (const s of run.steps) {
    if (s.kind === "tool") console.log(`  tool ${s.name}(${JSON.stringify(s.args)})\n       -> ${JSON.stringify(s.result)}`);
    else console.log(`${s.kind.toUpperCase()}: ${s.text}\n`);
  }
  console.log(`paid calls ${run.paidCalls}, spent ${run.spentAusd}`);
  if (run.steps.some((s) => s.kind === "error")) process.exit(1);
  if (!process.argv.includes("--no-save")) {
    const file = path.join(root, "AGENT_LLM_RUN.json");
    const prev = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { runs: [] };
    // Keep the latest run for each distinct task.
    const runs = [run, ...((prev.runs ?? []) as typeof run[]).filter((r) => r.task !== run.task)].slice(0, 4);
    fs.writeFileSync(file, JSON.stringify({ vendorUrl, runs }, null, 2) + "\n");
  }
}

main().catch((e) => { console.error(`ask FAILED: ${(e as Error).message}`); process.exit(1); });
