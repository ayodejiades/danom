/**
 * tools/live-run.ts — drives the DEPLOYED CreditVault on Monad testnet through a full credit cycle
 * and writes every transaction hash to LIVE_RUN.json.
 *
 * Roles: one funded key (PRIVATE_KEY) is the lender, sponsor, customer and keeper. The agent and the
 * vendor are fresh throwaway keys generated per run, each given a little gas by the funded key. The
 * agent never holds the stablecoin: it only asks the vault to fund channels and signs vouchers.
 *
 * What is real: the vault and the canonical x402BatchSettlement contract on Monad testnet, every
 * transaction below, and the refusals (an eth_call against the live vault). What is not: the token
 * is MockAUSD (open mint), the agent is a script and not a model, and no x402 facilitator is used
 * (the vendor claims directly as the receiver authorizer).
 *
 *   PRIVATE_KEY=0x… pnpm live:run     broadcast to Monad testnet (needs about 4 MON; Monad charges for the gas limit)
 *   pnpm live:dry                      the same code on a local Anvil fork, no key needed
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  createPublicClient, createTestClient, createWalletClient, http, parseAbi, parseEther,
  BaseError, ContractFunctionRevertedError, type Abi, type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";
import { fromUnits, toUnits } from "../lib/stream";

const DRY = process.argv.includes("--dry");
const root = process.cwd();

// Minimal .env reader so `pnpm live:run` works with PRIVATE_KEY kept in a gitignored .env.
if (fs.existsSync(path.join(root, ".env"))) {
  for (const line of fs.readFileSync(path.join(root, ".env"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const dep = JSON.parse(fs.readFileSync(path.join(root, ".kit", "deployment.json"), "utf8"));
const VAULT = dep.contractAddress as Hex;
const TOKEN = dep.token.address as Hex;
const SETTLEMENT = dep.x402BatchSettlement as Hex;
const TESTNET_RPC = process.env.RPC_URL || "https://testnet-rpc.monad.xyz";
const PORT = 8548;
const RPC = DRY ? `http://127.0.0.1:${PORT}` : TESTNET_RPC;
const EXPLORER = "https://testnet.monadscan.com";

const CFG = "(address payer,address payerAuthorizer,address receiver,address receiverAuthorizer,address token,uint40 withdrawDelay,bytes32 salt)";
const SETTLEMENT_ABI = parseAbi([
  `function getChannelId(${CFG} config) view returns (bytes32)`,
  "function channels(bytes32) view returns (uint128 balance, uint128 totalClaimed)",
  `function claim((( ${CFG} channel,uint128 maxClaimableAmount) voucher,bytes signature,uint128 totalClaimed)[] claims)`,
  "function settle(address receiver, address token)",
  `function refund(${CFG} config, uint128 amount)`,
]) as unknown as Abi;
const VOUCHER_TYPES = { Voucher: [{ name: "channelId", type: "bytes32" }, { name: "maxClaimableAmount", type: "uint128" }] } as const;

function artifact(name: string): Abi {
  const p = path.join(root, "contracts", "out", `${name}.sol`, `${name}.json`);
  if (!fs.existsSync(p)) throw new Error(`missing ${p}: run \`forge build\` first`);
  return JSON.parse(fs.readFileSync(p, "utf8")).abi as Abi;
}

function revertName(err: unknown): string {
  if (err instanceof BaseError) {
    const inner = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (inner instanceof ContractFunctionRevertedError) return inner.data?.errorName ?? inner.reason ?? "reverted";
  }
  return "reverted";
}

async function waitForRpc() {
  for (let i = 0; i < 150; i++) {
    try {
      const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' });
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("anvil did not start");
}

const salt = (n: number) => ("0x" + n.toString(16).padStart(64, "0")) as Hex;

async function main() {
  let anvil: ReturnType<typeof spawn> | undefined;
  const key = (DRY ? generatePrivateKey() : (process.env.PRIVATE_KEY as Hex | undefined));
  if (!key) throw new Error("PRIVATE_KEY is not set. Put a funded Monad testnet key in .env (gitignored), or run `pnpm live:dry`.");
  try {
    if (DRY) {
      anvil = spawn("anvil", ["--fork-url", TESTNET_RPC, "--port", String(PORT), "--silent"], { stdio: "ignore" });
      await waitForRpc();
    }
    const chain = (DRY ? { ...monadTestnet, rpcUrls: { default: { http: [RPC] } } } : monadTestnet) as typeof monadTestnet;
    const pub = createPublicClient({ chain, transport: http(RPC) });
    const wallet = (k: Hex) => createWalletClient({ account: privateKeyToAccount(k), chain, transport: http(RPC) });
    const funder = wallet(key);
    const agent = wallet(generatePrivateKey());
    const vendor = wallet(generatePrivateKey());
    const F = funder.account.address, AG = agent.account.address, VN = vendor.account.address;
    if (DRY) await createTestClient({ chain, mode: "anvil", transport: http(RPC) }).setBalance({ address: F, value: parseEther("10") });

    const have = await pub.getBalance({ address: F });
    console.log(`${DRY ? "DRY RUN (local fork)" : "LIVE (Monad testnet)"} funder ${F} balance ${(Number(have) / 1e18).toFixed(3)} MON`);
    // Monad charges for the gas limit, not the gas used, so every 800k-limit call reserves up to ~0.15 MON.
    if (have < parseEther("4")) throw new Error("funder needs at least 4 MON for gas (the agent and vendor get 0.8 each)");

    const vaultAbi = artifact("CreditVault");
    const tokenAbi = artifact("MockAUSD");
    type W = typeof funder;
    const tx: { step: string; hash: Hex; block: string; explorer: string }[] = [];
    const step = async (name: string, hash: Hex) => {
      const rc = await pub.waitForTransactionReceipt({ hash });
      if (rc.status !== "success") {
        const t = await pub.getTransaction({ hash });
        let why = "unknown";
        try { await pub.call({ account: t.from, to: t.to!, data: t.input, blockNumber: rc.blockNumber - BigInt(1) }); } catch (e) { why = revertName(e) + " | " + (e as Error).message.split("\n")[0]; }
        throw new Error(`${name} reverted (${hash}); replay says: ${why}`);
      }
      tx.push({ step: name, hash, block: rc.blockNumber.toString(), explorer: `${EXPLORER}/tx/${hash}` });
      console.log(`  ${String(tx.length).padStart(2, "0")} ${name}`);
      return rc;
    };
    // Explicit gas: estimation under-counts the nested token transfers inside the x402 contract.
    const GAS = BigInt(800_000);
    const call = (c: W, address: Hex, abi: Abi, fn: string, args: unknown[]) => c.writeContract({ address, abi, functionName: fn, args, gas: GAS } as never);
    const V = (c: W, fn: string, args: unknown[]) => call(c, VAULT, vaultAbi, fn, args);
    const read = async <T,>(address: Hex, abi: Abi, fn: string, args: unknown[] = []) => (await pub.readContract({ address, abi, functionName: fn, args })) as T;
    const bal = (who: Hex) => read<bigint>(TOKEN, tokenAbi, "balanceOf", [who]);
    const debt = () => read<bigint>(VAULT, vaultAbi, "debtOf", [F, AG]);

    // Fresh agent and vendor keys make every run self-contained: a new line, new channels.
    const run = BigInt(Date.now());
    await step("funder sends the agent gas", await funder.sendTransaction({ to: AG, value: parseEther("0.8") }));
    await step("funder sends the vendor gas", await funder.sendTransaction({ to: VN, value: parseEther("0.8") }));
    await step("mint test stablecoin to the funder", await call(funder, TOKEN, tokenAbi, "mint", [F, toUnits(3000)]));
    await step("funder approves the vault", await call(funder, TOKEN, tokenAbi, "approve", [VAULT, toUnits(1_000_000)]));
    await step("lender supplies 1000 to the vault", await V(funder, "supply", [toUnits(1000)]));
    await step("sponsor opens a line for the agent: 400 collateral, 100 base, 40 per channel, 10% APR, 30 days, 50% revenue share",
      await V(funder, "openLine", [AG, toUnits(400), toUnits(100), toUnits(40), 1000, BigInt(30 * 86400), 5000]));
    await step("sponsor allowlists the vendor", await V(funder, "setVendor", [AG, VN, VN]));
    await step("sponsor allowlists the customer as a revenue payer", await V(funder, "setRevenuePayer", [AG, F, true]));

    const config = (s: number) => ({ payer: VAULT, payerAuthorizer: AG, receiver: VN, receiverAuthorizer: VN, token: TOKEN, withdrawDelay: 900, salt: salt(Number(run % 1_000_000n) * 100 + s) });
    const chId = (s: number) => read<Hex>(SETTLEMENT, SETTLEMENT_ABI, "getChannelId", [config(s)]);
    const chainId = await pub.getChainId();
    const domain = { name: "x402 Batch Settlement", version: "1", chainId, verifyingContract: SETTLEMENT } as const;
    const voucher = async (signer: W, id: Hex, max: bigint) =>
      signer.account!.signTypedData({ domain, types: VOUCHER_TYPES, primaryType: "Voucher", message: { channelId: id, maxClaimableAmount: max } });

    // The scripted agent: it asks the vendor for a price, has the vault fund a channel, and signs a voucher.
    // It never touches the stablecoin: its token balance is checked at the end.
    const agentBuys = async (s: number, quote: bigint, fundAmt: bigint, label: string) => {
      await step(`agent asks the vault to fund a ${fromUnits(fundAmt, 2)} channel for the vendor (${label})`,
        await V(agent, "fundChannel", [F, VN, 900, config(s).salt, fundAmt]));
      const id = await chId(s);
      const sig = await voucher(agent, id, quote); // the agent's only act: signing a voucher
      await step(`vendor claims the agent's signed voucher for ${fromUnits(quote, 2)}`,
        await call(vendor, SETTLEMENT, SETTLEMENT_ABI, "claim", [[{ voucher: { channel: config(s), maxClaimableAmount: quote }, signature: sig, totalClaimed: quote }]]));
      await step("anyone settles the claimed funds to the vendor", await call(funder, SETTLEMENT, SETTLEMENT_ABI, "settle", [VN, TOKEN]));
      return id;
    };

    const vendorBefore = await bal(VN);
    // Cycle 1: vendor takes 25 of a 40 channel and refunds the rest; reconcile books the refund.
    await agentBuys(1, toUnits(25), toUnits(40), "quote 25");
    const debtAfterFund = await debt();
    await step("vendor refunds the 15 it did not use, straight to the vault", await call(vendor, SETTLEMENT, SETTLEMENT_ABI, "refund", [config(1), toUnits(15)]));
    await step("anyone reconciles: debt drops by 15", await call(funder, VAULT, vaultAbi, "reconcile", [config(1)]));
    const debtAfterReconcile = await debt();
    // Cycle 2: the sponsor repays, building the record.
    await step("sponsor repays the 25 owed", await V(funder, "repay", [F, AG, toUnits(25)]));
    // Cycle 3: revenue repays the loan first.
    await agentBuys(2, toUnits(40), toUnits(40), "quote 40");
    const debtBeforeRevenue = await debt();
    const agentBefore = await bal(AG);
    await step("a customer pays the agent 100 through the vault: the loan is repaid first", await V(funder, "receiveRevenue", [F, AG, toUnits(100)]));
    const agentGot = (await bal(AG)) - agentBefore;
    const debtAfterRevenue = await debt();

    // Refusals: eth_call against the live vault, nothing is sent.
    const refusals: { attempt: string; expected: string; refusedWith: string }[] = [];
    const sim = async (attempt: string, expected: string, account: Hex, fn: string, args: unknown[]) => {
      let got = "NOT_REFUSED";
      try { await pub.simulateContract({ address: VAULT, abi: vaultAbi, functionName: fn, args, account }); } catch (e) { got = revertName(e); }
      refusals.push({ attempt, expected, refusedWith: got });
      console.log(`  refused? ${got === expected ? "yes" : "NO"}  ${attempt} -> ${got}`);
    };
    await sim("agent tries to fund a channel paying itself", "ReceiverNotAllowed", AG, "fundChannel", [F, AG, 900, salt(900), toUnits(10)]);
    await sim("agent funds 41 (cap is 40)", "OverPerBorrowCap", AG, "fundChannel", [F, VN, 900, salt(901), toUnits(41)]);
    await sim("a wallet that is not the agent funds on the agent's line", "LineInactive", F, "fundChannel", [F, VN, 900, salt(902), toUnits(10)]);
    await step("sponsor revokes the line", await V(funder, "revoke", [AG]));
    await sim("agent funds after revoke", "LineInactive", AG, "fundChannel", [F, VN, 900, salt(903), toUnits(5)]);

    const agentTokens = await bal(AG);
    const [repaid, , , tier] = await read<[bigint, bigint, bigint, bigint]>(VAULT, vaultAbi, "recordOf", [AG]);
    const summary = {
      agentOwnFundsAusd: fromUnits(agentTokens - agentGot, 2),
      debtAfterFundAusd: fromUnits(debtAfterFund, 2), debtAfterReconcileAusd: fromUnits(debtAfterReconcile, 2),
      debtBeforeRevenueAusd: fromUnits(debtBeforeRevenue, 2), customerPaidAusd: "100.00", agentReceivedAusd: fromUnits(agentGot, 2), debtAfterRevenueAusd: fromUnits(debtAfterRevenue, 2),
      vendorReceivedAusd: fromUnits((await bal(VN)) - vendorBefore, 2), repaidPrincipalAusd: fromUnits(repaid, 2), tier: Number(tier),
    };
    console.log(JSON.stringify(summary, null, 2));
    const out = {
      generatedAt: new Date().toISOString(), network: "Monad Testnet", chainId, mode: DRY ? "ANVIL_FORK_DRY_RUN" : "MONAD_TESTNET_LIVE",
      contracts: { CreditVault: VAULT, MockAUSD: TOKEN, x402BatchSettlement: SETTLEMENT },
      accounts: { funder: F, agent: AG, vendor: VN },
      note: "Scripted agent, test token, no facilitator. Every transaction below was sent by tools/live-run.ts.",
      summary, refusals, transactions: tx,
    };
    if (!DRY) fs.writeFileSync(path.join(root, "LIVE_RUN.json"), JSON.stringify(out, null, 2) + "\n");
    const matched = refusals.filter((r) => r.expected === r.refusedWith).length;
    console.log(`${DRY ? "dry run" : "live run"} ok: ${tx.length} transactions, ${matched}/${refusals.length} refusals matched${DRY ? " (nothing written)" : " -> LIVE_RUN.json"}`);
    if (matched !== refusals.length) process.exitCode = 1;
  } finally {
    anvil?.kill();
  }
}

main().catch((e) => { console.error("live-run FAILED:", e instanceof Error ? e.message : e); process.exit(1); });
