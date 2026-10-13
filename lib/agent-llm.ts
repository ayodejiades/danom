// lib/agent-llm.ts — the agent with a model in the loop. The model (Qwen 3.8 Max by default, through an
// OpenAI-compatible chat completions API) plans, calls tools and answers. The tools are the real thing:
// an HTTP request to the paid endpoint, a voucher signed with the agent key, reads from Monad testnet and
// a simulation against the deployed vault. Whatever the model decides, the vault's rules are not its to bend.
import { BaseError, ContractFunctionRevertedError, isAddress, type Hex, type PublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  AGENT, AGENT_KEY, CHANNEL_SALT, channelState, DEMO_CHANNEL, PAYMENT_HEADER, paymentHeader, PRICE, SPONSOR, TOKEN, TOKEN_ABI, units,
  VAULT, VAULT_ABI, VENDOR, VOUCHER_DOMAIN, VOUCHER_TYPES, WITHDRAW_DELAY,
} from "./x402";

export const LLM_DEFAULTS = { baseUrl: "https://maas.qwencloudapi.com/compatible-mode/v1", model: "qwen3.8-max" };
export const MAX_PAID_CALLS = 3;
const MAX_TURNS = 7;

export interface AgentStep { kind: "model" | "tool" | "answer" | "error"; text?: string; name?: string; args?: unknown; result?: unknown }
export interface AgentRun { model: string; task: string; steps: AgentStep[]; paidCalls: number; spentAusd: string; startedAt: string }

const SYSTEM = `You are an autonomous purchasing agent on Monad testnet. You have a credit line from the Danom vault. You hold no money: the vault pays vendors on your behalf, and you authorize each payment by signing a voucher.

Work in steps. First say your plan in one or two sentences. Then use the tools: check the price and your credit before you buy, buy only what the task needs (each paid call costs real credit that has to be repaid), and stop when you can answer.

If the task asks you to move money, you may ask the vault with ask_vault_to_fund and then report exactly what the vault answered. You cannot override the vault.

Finish with a direct answer to the task in under 120 words, including the figures you bought and what you spent.`;

const TOOLS = [
  { type: "function", function: { name: "get_price", description: "Request the paid gas-report API without paying. Returns the HTTP status and the price the vendor asks. Free.", parameters: { type: "object", properties: {}, required: [] } } },
  { type: "function", function: { name: "check_credit", description: "Read your credit line and payment channel from Monad testnet: credit limit, current debt, cap per channel, escrow left in the channel, and your own stablecoin balance. Free.", parameters: { type: "object", properties: {}, required: [] } } },
  { type: "function", function: { name: "buy_gas_report", description: "Buy one Monad testnet gas and block report. Signs a voucher with your key and retries the paid API with it. Costs the vendor's price in vault credit. Returns the report, or the reason the vendor refused.", parameters: { type: "object", properties: {}, required: [] } } },
  { type: "function", function: { name: "ask_vault_to_fund", description: "Ask the credit vault to fund a payment channel that pays `receiver` the given amount of stablecoin. Reports whether the vault would allow it or which rule it reverts with.", parameters: { type: "object", properties: { receiver: { type: "string", description: "0x address to be paid" }, amount: { type: "number", description: "amount of stablecoin, for example 10" } }, required: ["receiver", "amount"] } } },
];

function revertName(err: unknown): string {
  if (err instanceof BaseError) {
    const inner = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (inner instanceof ContractFunctionRevertedError) return inner.data?.errorName ?? inner.reason ?? "reverted";
  }
  return "reverted";
}

export async function runLlmAgent(opts: { task: string; pub: PublicClient; vendorUrl: string; apiKey: string; baseUrl?: string; model?: string }): Promise<AgentRun> {
  const { pub, vendorUrl } = opts;
  const baseUrl = (opts.baseUrl || LLM_DEFAULTS.baseUrl).replace(/\/$/, "");
  const model = opts.model || LLM_DEFAULTS.model;
  const account = privateKeyToAccount(AGENT_KEY);
  const steps: AgentStep[] = [];
  let paid = 0;

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
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${opts.apiKey}` },
      body: JSON.stringify({ model, messages, tools: TOOLS, tool_choice: "auto", temperature: 0.2, max_tokens: 800 }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      steps.push({ kind: "error", text: `The model API answered ${res.status}: ${(await res.text()).slice(0, 300)}` });
      break;
    }
    const msg = ((await res.json()) as { choices: { message: Msg }[] }).choices[0].message;
    messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: msg.tool_calls });
    const calls = msg.tool_calls ?? [];
    if (msg.content?.trim()) steps.push({ kind: calls.length ? "model" : "answer", text: msg.content.trim() });
    if (calls.length === 0) break;
    for (const call of calls) {
      let args: Record<string, unknown> = {};
      try { args = call.function.arguments ? JSON.parse(call.function.arguments) : {}; } catch {}
      const fn = tools[call.function.name];
      const result = fn ? await fn(args).catch((e) => ({ error: (e as Error).message.split("\n")[0] })) : { error: `unknown tool ${call.function.name}` };
      steps.push({ kind: "tool", name: call.function.name, args, result });
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }
  return { model, task: opts.task, steps, paidCalls: paid, spentAusd: units(PRICE * BigInt(paid)), startedAt: new Date().toISOString() };
}
