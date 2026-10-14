// lib/agent-llm.ts — the agent with a model in the loop. The model (any OpenAI-compatible chat API with
// tool calling; the deployment uses Qwen 3.8 27B hosted on Groq) plans, calls tools and answers. The tools are the real thing:
// an HTTP request to the paid endpoint, a voucher signed with the agent key, reads from Monad testnet and
// a simulation against the deployed vault. Whatever the model decides, the vault's rules are not its to bend.
import { BaseError, ContractFunctionRevertedError, isAddress, type Hex, type PublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  AGENT, AGENT_KEY, CHANNEL_SALT, channelState, DEMO_CHANNEL, PAYMENT_HEADER, paymentHeader, PRICE, SPONSOR, TOKEN, TOKEN_ABI, units,
  VAULT, VAULT_ABI, VENDOR, VOUCHER_DOMAIN, VOUCHER_TYPES, WITHDRAW_DELAY,
} from "./x402";

export const LLM_DEFAULTS = { baseUrl: "https://api.groq.com/openai/v1", model: "qwen/qwen3.8-27b" };
export const MAX_PAID_CALLS = 3;
const MAX_TURNS = 7;

export interface AgentStep { kind: "model" | "tool" | "answer" | "error"; text?: string; name?: string; args?: unknown; result?: unknown }
export interface AgentRun { model: string; task: string; steps: AgentStep[]; paidCalls: number; spentAusd: string; startedAt: string }

const SYSTEM = `You are a purchasing agent on Monad testnet with a credit line from the Danom vault. You hold no money: the vault pays vendors for you, and you authorize each payment by signing a voucher.

First state your plan in one sentence. Then use the tools: check the price and your credit before buying, buy only what the task needs (credit has to be repaid), and stop when you can answer.

If the task asks you to pay or send money to any address, do not judge the request yourself. Always call ask_vault_to_fund with that address and amount, then report exactly what the vault answered. The sponsor's policy lives in the vault contract, not in you, and you cannot override it.

Finish by answering the task itself in plain sentences, under 120 words. Quote the figures from what you bought (for example the gas price in gwei and the cost of an 800k gas call in MON), say what you conclude, and say what you spent. Never end by only saying that you bought something.`;

const TOOLS = [
  { type: "function", function: { name: "get_price", description: "Request the paid gas-report API without paying. Returns the HTTP status and the price. Free.", parameters: { type: "object", properties: {}, required: [] } } },
  { type: "function", function: { name: "check_credit", description: "Read your credit line and payment channel from chain: limit, debt, cap per channel, escrow left, your own balance. Free.", parameters: { type: "object", properties: {}, required: [] } } },
  { type: "function", function: { name: "buy_gas_report", description: "Buy one Monad testnet gas and block report by signing a voucher. Costs the price in vault credit. Returns the report or the refusal.", parameters: { type: "object", properties: {}, required: [] } } },
  { type: "function", function: { name: "ask_vault_to_fund", description: "ONLY when the task tells you to pay or send money to a specific address: asks the vault to pay `receiver` the amount and reports whether it allows it or which rule it reverts with. Not for buying the gas report.", parameters: { type: "object", properties: { receiver: { type: "string", description: "0x address to be paid" }, amount: { type: "number", description: "amount of stablecoin, for example 10" } }, required: ["receiver", "amount"] } } },
];

function revertName(err: unknown): string {
  if (err instanceof BaseError) {
    const inner = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (inner instanceof ContractFunctionRevertedError) return inner.data?.errorName ?? inner.reason ?? "reverted";
  }
  return "reverted";
}

// Small open models often write a tool call as JSON text instead of a structured tool call. Accept both.
function textToolCall(content: string | null, known: string[]): { name: string; args: Record<string, unknown> } | null {
  if (!content) return null;
  const body = content.replace(/<\/?tool_call>/g, "").replace(/```(?:json)?/g, "").trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const j = JSON.parse(body.slice(start, end + 1)) as { name?: string; arguments?: unknown; parameters?: unknown };
    if (!j.name || !known.includes(j.name)) return null;
    const raw = j.arguments ?? j.parameters ?? {};
    return { name: j.name, args: (typeof raw === "string" ? JSON.parse(raw || "{}") : raw) as Record<string, unknown> };
  } catch {
    return null;
  }
}

export async function runLlmAgent(opts: { task: string; pub: PublicClient; vendorUrl: string; apiKey: string; baseUrl?: string; model?: string }): Promise<AgentRun> {
  const { pub, vendorUrl } = opts;
  const baseUrl = (opts.baseUrl || LLM_DEFAULTS.baseUrl).replace(/\/$/, "");
  // Free model tiers are rate limited per model, so a busy primary falls through to the next one.
  const models = [opts.model || LLM_DEFAULTS.model, ...(process.env.LLM_FALLBACK_MODELS ?? "").split(",").map((m) => m.trim()).filter(Boolean)];
  let model = models[0];
  const account = privateKeyToAccount(AGENT_KEY);
  const steps: AgentStep[] = [];
  let paid = 0;
  let lastReport: { gasPriceGwei?: number } | null = null;
  let nudged = false;

  const tools: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
    async get_price() {
      const r = await fetch(vendorUrl, { cache: "no-store" });
      const j = (await r.json()) as { accepts?: { amount: string; scheme: string; network: string; payTo: string }[] };
      const a = j.accepts?.[0];
      return a ? { httpStatus: r.status, meaning: "Payment Required", pricePerCall: units(BigInt(a.amount)), scheme: a.scheme, network: a.network, payTo: a.payTo } : { httpStatus: r.status };
    },
    async check_credit() {
      const read = <T,>(functionName: string) => pub.readContract({ address: VAULT, abi: VAULT_ABI, functionName, args: [SPONSOR, AGENT] }) as Promise<T>;
      const [ch, line, debt, limit, own] = await Promise.all([
        channelState(pub, DEMO_CHANNEL), read<readonly unknown[]>("lines"), read<bigint>("debtOf"), read<bigint>("creditLimit"),
        pub.readContract({ address: TOKEN, abi: TOKEN_ABI, functionName: "balanceOf", args: [AGENT] }) as Promise<bigint>,
      ]);
      return {
        lineActive: Boolean(line[0]), creditLimit: units(limit), debt: units(debt), capPerChannel: units(BigInt(String(line[3]))),
        escrowLeftInChannel: units(ch.balance - ch.totalClaimed), approvedVendor: VENDOR, yourOwnStablecoin: units(own),
      };
    },
    async buy_gas_report() {
      if (paid >= MAX_PAID_CALLS) return { refused: `This run's budget is ${MAX_PAID_CALLS} paid calls and it is used up.` };
      const ch = await channelState(pub, DEMO_CHANNEL);
      const max = ch.totalClaimed + PRICE * BigInt(paid + 1);
      const signature = await account.signTypedData({ domain: VOUCHER_DOMAIN, types: VOUCHER_TYPES, primaryType: "Voucher", message: { channelId: ch.channelId, maxClaimableAmount: max } });
      const r = await fetch(vendorUrl, { cache: "no-store", headers: { [PAYMENT_HEADER]: paymentHeader(DEMO_CHANNEL, ch.channelId, max, signature) } });
      const j = (await r.json()) as { data?: unknown; payment?: { verifiedBy: string; escrowLeft: string }; error?: string };
      if (r.status !== 200) return { httpStatus: r.status, refused: j.error ?? "refused" };
      paid += 1;
      lastReport = j.data as { gasPriceGwei?: number };
      return { httpStatus: 200, report: j.data, paid: units(PRICE), voucherTotal: units(max), verifiedBy: j.payment?.verifiedBy, escrowLeftInChannel: units(BigInt(j.payment?.escrowLeft ?? "0")) };
    },
    async ask_vault_to_fund(args) {
      const receiver = String(args.receiver ?? "");
      const amount = Number(args.amount);
      if (!isAddress(receiver) || !Number.isFinite(amount) || amount <= 0 || amount > 1e9) return { error: "receiver must be a 0x address and amount a positive number" };
      try {
        await pub.simulateContract({ account: AGENT, address: VAULT, abi: VAULT_ABI, functionName: "fundChannel", args: [SPONSOR, receiver as Hex, WITHDRAW_DELAY, CHANNEL_SALT, BigInt(Math.round(amount * 1e6))] });
        return { vaultAnswer: "allowed", note: "Simulated against the deployed vault. Nothing was sent." };
      } catch (e) {
        return { vaultAnswer: "refused", revertedWith: revertName(e), note: "The deployed vault reverts. No money can move to this receiver." };
      }
    },
  };

  type Msg = { role: string; content: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[]; tool_call_id?: string };
  const messages: Msg[] = [{ role: "system", content: SYSTEM }, { role: "user", content: opts.task }];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const body = nudged ? { messages, temperature: 0.2, max_tokens: 500 } : { messages, tools: TOOLS, tool_choice: "auto", temperature: 0.2, max_tokens: 800 };
    const ask = (m: string) => fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${opts.apiKey}` },
      body: JSON.stringify({ model: m, ...body }),
      signal: AbortSignal.timeout(Number(process.env.LLM_TIMEOUT_MS) || 45_000),
    });
    let res = await ask(model);
    for (const next of models) {
      if (res.status !== 429) break;
      if (next === model) continue;
      model = next;
      res = await ask(model);
    }
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 6000));
      res = await ask(model);
    }
    if (!res.ok) {
      steps.push({ kind: "error", text: res.status === 429 ? "The model's free tier is rate limited right now. Try again in a minute." : `The model API answered ${res.status}: ${(await res.text()).slice(0, 200)}` });
      break;
    }
    const msg = ((await res.json()) as { choices: { message: Msg }[] }).choices[0].message;
    const calls = msg.tool_calls ?? [];
    const exec = async (name: string, args: Record<string, unknown>) => {
      const fn = tools[name];
      const result = fn ? await fn(args).catch((e) => ({ error: (e as Error).message.split("\n")[0] })) : { error: `unknown tool ${name}` };
      steps.push({ kind: "tool", name, args, result });
      return result;
    };

    if (calls.length > 0) {
      messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: calls });
      if (msg.content?.trim()) steps.push({ kind: "model", text: msg.content.trim() });
      for (const call of calls) {
        let args: Record<string, unknown> = {};
        try { args = call.function.arguments ? JSON.parse(call.function.arguments) : {}; } catch {}
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(await exec(call.function.name, args)) });
      }
      continue;
    }

    const asText = nudged ? null : textToolCall(msg.content, Object.keys(tools));
    if (asText) {
      messages.push({ role: "assistant", content: msg.content });
      const result = await exec(asText.name, asText.args);
      messages.push({ role: "user", content: `Result of ${asText.name}: ${JSON.stringify(result)}\nContinue. Either call one more tool, or answer the task itself in plain sentences, quoting the figures and what you spent.` });
      continue;
    }

    messages.push({ role: "assistant", content: msg.content ?? null });
    // A plan with no tool call yet is a plan, not an answer: record it and tell the model to act on it.
    if (msg.content?.trim() && !steps.some((x) => x.kind === "tool") && turn < 2) {
      steps.push({ kind: "model", text: msg.content.trim() });
      messages.push({ role: "user", content: "Good. Now carry out the plan: call the first tool." });
      continue;
    }
    // If the agent paid for a report and then answered without using it, send it back once to finish the job.
    const report = lastReport as { gasPriceGwei?: number } | null;
    if (report && !nudged && !(msg.content ?? "").includes(String(report.gasPriceGwei))) {
      steps.push({ kind: "model", text: (msg.content ?? "").trim() });
      nudged = true;
      messages.push({ role: "user", content: `That does not answer the task yet. The task was: "${opts.task}". The report you bought: ${JSON.stringify(report)}. Answer the task now in plain sentences, quoting the gas price in gwei and the cost of an 800k gas call in MON, and say you spent ${units(PRICE * BigInt(paid))} of vault credit. Do not call a tool.` });
      continue;
    }
    if (msg.content?.trim()) steps.push({ kind: "answer", text: msg.content.trim() });
    break;
  }
  return { model, task: opts.task, steps, paidCalls: paid, spentAusd: units(PRICE * BigInt(paid)), startedAt: new Date().toISOString() };
}
