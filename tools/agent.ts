/**
 * tools/agent.ts — the agent buys data from a paid HTTP endpoint, and the vault pays for it.
 *
 * 1. The agent requests the vendor's API and gets HTTP 402 with a price.
 * 2. If the channel to that vendor has no escrow, the agent asks the vault to fund it (an on chain
 *    transaction from the agent's key; the money comes from the vault, not from the agent).
 * 3. The agent signs a cumulative voucher, retries with it in the payment header, and gets the data.
 * 4. The vendor claims the last voucher on chain and settles the funds to itself.
 *
 * The agent key is the public demo key in lib/x402.ts. The sponsor is PRIVATE_KEY in .env and is only
 * needed once, to open the agent's line. The vendor is VENDOR_PRIVATE_KEY in .env.
 *
 *   pnpm agent:dry    rehearse on a local fork of Monad testnet, against a local copy of the vendor
 *   pnpm agent:live   broadcast to Monad testnet and call the deployed vendor (VENDOR_URL to override)
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import {
  BaseError, ContractFunctionRevertedError, createPublicClient, createTestClient, createWalletClient, http as rpc, parseEther,
  type Abi, type Hex, type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";
import {
  AGENT, AGENT_KEY, CHANNEL_DEPOSIT, CHANNEL_SALT, channelState, DEMO_CHANNEL, EXPLORER, handleVendorRequest, PAYMENT_HEADER, paymentHeader,
  PRICE, RPC_URL, SETTLEMENT, SETTLEMENT_ABI, SPONSOR, TOKEN, TOKEN_ABI, units, VAULT, VAULT_ABI, VENDOR, VOUCHER_DOMAIN, VOUCHER_TYPES, WITHDRAW_DELAY,
} from "../lib/x402";

const root = process.cwd();
const DRY = process.argv.includes("--dry");
const LOCAL_VENDOR = DRY || process.argv.includes("--local");
const CALLS = 3;

if (fs.existsSync(path.join(root, ".env"))) {
  for (const line of fs.readFileSync(path.join(root, ".env"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const FORK_PORT = 8552;
const VENDOR_PORT = 8553;
const RPC = DRY ? `http://127.0.0.1:${FORK_PORT}` : process.env.RPC_URL || RPC_URL;
const DEPLOYED_VENDOR = "https://monad-metropolis-one.vercel.app/api/vendor/gas";
const GAS = BigInt(800_000); // estimation under-counts the nested token transfers inside the x402 contract

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

async function main() {
  let anvil: ReturnType<typeof spawn> | undefined;
  let server: http.Server | undefined;
  try {
    if (DRY) {
      anvil = spawn("anvil", ["--fork-url", RPC_URL, "--port", String(FORK_PORT), "--silent"], { stdio: "ignore" });
      await waitForRpc();
    }
    const chain = (DRY ? { ...monadTestnet, rpcUrls: { default: { http: [RPC] } } } : monadTestnet) as typeof monadTestnet;
    const pub = createPublicClient({ chain, transport: rpc(RPC) }) as PublicClient;
    const agent = createWalletClient({ account: privateKeyToAccount(AGENT_KEY), chain, transport: rpc(RPC) });
    const vendorKey = process.env.VENDOR_PRIVATE_KEY as Hex | undefined;
    if (!vendorKey) throw new Error("VENDOR_PRIVATE_KEY is not set in .env");
    const vendor = createWalletClient({ account: privateKeyToAccount(vendorKey), chain, transport: rpc(RPC) });
    if (vendor.account.address.toLowerCase() !== VENDOR.toLowerCase()) throw new Error(`VENDOR_PRIVATE_KEY does not match the vendor address ${VENDOR} in lib/x402.ts`);

    // The sponsor: the real key on testnet, an impersonated account on the fork.
    let sponsor;
    if (DRY) {
      const test = createTestClient({ chain, mode: "anvil", transport: rpc(RPC) });
      await test.impersonateAccount({ address: SPONSOR });
      await test.setBalance({ address: SPONSOR, value: parseEther("10") });
      sponsor = createWalletClient({ account: SPONSOR, chain, transport: rpc(RPC) });
    } else {
      const key = process.env.PRIVATE_KEY as Hex | undefined;
      if (!key) throw new Error("PRIVATE_KEY is not set in .env. It is the sponsor that opens the agent's credit line.");
      sponsor = createWalletClient({ account: privateKeyToAccount(key), chain, transport: rpc(RPC) });
      if (sponsor.account.address.toLowerCase() !== SPONSOR.toLowerCase()) throw new Error(`PRIVATE_KEY must be the sponsor ${SPONSOR}`);
    }

    const tx: { step: string; hash: Hex; block: string; explorer: string }[] = [];
    const step = async (name: string, hash: Hex) => {
      const rc = await pub.waitForTransactionReceipt({ hash });
      if (rc.status !== "success") throw new Error(`${name} reverted (${hash})`);
      tx.push({ step: name, hash, block: rc.blockNumber.toString(), explorer: `${EXPLORER}/tx/${hash}` });
      console.log(`  tx ${String(tx.length).padStart(2, "0")}  ${name}`);
    };
    type W = { writeContract: (a: never) => Promise<Hex> };
    const write = (c: unknown, address: Hex, abi: Abi, functionName: string, args: unknown[]) => (c as W).writeContract({ address, abi, functionName, args, gas: GAS } as never);
    const read = <T,>(address: Hex, abi: Abi, functionName: string, args: unknown[] = []) => pub.readContract({ address, abi, functionName, args }) as Promise<T>;
    const U = (n: number) => BigInt(n) * BigInt(1_000_000);

    console.log(`${DRY ? "DRY RUN (local fork)" : "LIVE (Monad testnet)"}  agent ${AGENT}  vendor ${VENDOR}`);

    // ---- One-time setup by the sponsor. Every step is skipped when it is already in place.
    console.log("\nSponsor: make sure the agent has a credit line and gas");
    const line = await read<readonly unknown[]>(VAULT, VAULT_ABI, "lines", [SPONSOR, AGENT]);
    if (!line[0]) {
      if ((await read<bigint>(TOKEN, TOKEN_ABI, "balanceOf", [SPONSOR])) < U(400)) await step("mint test stablecoin to the sponsor", await write(sponsor, TOKEN, TOKEN_ABI, "mint", [SPONSOR, U(1000)]));
      if ((await read<bigint>(TOKEN, TOKEN_ABI, "allowance", [SPONSOR, VAULT])) < U(400)) await step("sponsor approves the vault", await write(sponsor, TOKEN, TOKEN_ABI, "approve", [VAULT, U(1_000_000)]));
      await step("sponsor opens a line for the agent: 400 collateral, 100 limit, 40 per channel, 30 days",
        await write(sponsor, VAULT, VAULT_ABI, "openLine", [AGENT, U(400), U(100), U(40), 1000, BigInt(30 * 86400), 5000]));
    }
    if (/^0x0+$/.test(await read<Hex>(VAULT, VAULT_ABI, "receiverAuthorizerOf", [SPONSOR, AGENT, VENDOR]))) {
      await step("sponsor approves the vendor for this agent", await write(sponsor, VAULT, VAULT_ABI, "setVendor", [AGENT, VENDOR, VENDOR]));
    }
    // Monad charges for the gas limit, so each 800k-limit call reserves up to about 0.15 MON.
    const sendGas = (to: Hex) => (sponsor as unknown as { sendTransaction: (a: never) => Promise<Hex> }).sendTransaction({ to, value: parseEther("0.6") } as never);
    if ((await pub.getBalance({ address: AGENT })) < parseEther("0.3")) await step("sponsor sends the agent gas (MON only, no stablecoin)", await sendGas(AGENT));
    if ((await pub.getBalance({ address: VENDOR })) < parseEther("0.4")) await step("sponsor sends the vendor gas", await sendGas(VENDOR));
    if (tx.length === 0) console.log("  already in place");

    // ---- The vendor's API. On the fork (or with --local) this process serves the same handler the site does.
    let url = process.env.VENDOR_URL || DEPLOYED_VENDOR;
    if (LOCAL_VENDOR) {
      server = http.createServer(async (req, res) => {
        const h = req.headers[PAYMENT_HEADER.toLowerCase()];
        const reply = await handleVendorRequest(pub, typeof h === "string" ? h : null, `http://127.0.0.1:${VENDOR_PORT}/api/vendor/gas`, !DRY);
        res.writeHead(reply.status, { "content-type": "application/json", ...reply.headers });
        res.end(JSON.stringify(reply.body));
      });
      await new Promise<void>((r) => server!.listen(VENDOR_PORT, r));
      url = `http://127.0.0.1:${VENDOR_PORT}/api/vendor/gas`;
    }

    // ---- The agent.
    console.log(`\nAgent: GET ${url}`);
    const first = await fetch(url);
    if (first.status !== 402) throw new Error(`expected HTTP 402 from the vendor, got ${first.status}. Is the endpoint deployed? Use --local to serve it from this process.`);
    const required = (await first.json()) as { accepts: { amount: string; payTo: Hex; scheme: string; network: string }[] };
    const offer = required.accepts[0];
    console.log(`  402 Payment Required: ${units(BigInt(offer.amount))} per call, scheme ${offer.scheme}, pay to ${offer.payTo} on ${offer.network}`);
    if (offer.payTo.toLowerCase() !== VENDOR.toLowerCase()) throw new Error("the vendor asked to be paid at an address the sponsor never approved");

    // A stolen key cannot redirect the money: the vault refuses any receiver the sponsor did not approve.
    try {
      await pub.simulateContract({ account: AGENT, address: VAULT, abi: VAULT_ABI, functionName: "fundChannel", args: [SPONSOR, AGENT, WITHDRAW_DELAY, CHANNEL_SALT, U(10)] });
      throw new Error("the vault agreed to pay the agent itself");
    } catch (e) {
      if (revertName(e) === "reverted" && (e as Error).message.includes("agreed to pay")) throw e;
      console.log(`  (the same key asking the vault to pay itself is refused: ${revertName(e)})`);
    }

    let ch = await channelState(pub, DEMO_CHANNEL);
    if (ch.balance - ch.totalClaimed < PRICE * BigInt(CALLS)) {
      console.log(`  channel escrow is ${units(ch.balance - ch.totalClaimed)}; the agent asks the vault to fund ${units(CHANNEL_DEPOSIT)}`);
      await step(`agent asks the vault to fund a ${units(CHANNEL_DEPOSIT)} channel to the vendor`,
        await write(agent, VAULT, VAULT_ABI, "fundChannel", [SPONSOR, VENDOR, WITHDRAW_DELAY, CHANNEL_SALT, CHANNEL_DEPOSIT]));
      ch = await channelState(pub, DEMO_CHANNEL);
    }
    console.log(`  channel ${ch.channelId.slice(0, 10)}… holds ${units(ch.balance - ch.totalClaimed)} of vault money; claimed so far ${units(ch.totalClaimed)}`);

    const calls: { n: number; voucherTotal: string; status: number; blockNumber: string; gasPriceGwei: number; verifiedBy: string }[] = [];
    let last = { max: ch.totalClaimed, signature: "0x" as Hex };
    for (let n = 1; n <= CALLS; n++) {
      const max = ch.totalClaimed + PRICE * BigInt(n);
      const signature = await agent.account.signTypedData({ domain: VOUCHER_DOMAIN, types: VOUCHER_TYPES, primaryType: "Voucher", message: { channelId: ch.channelId, maxClaimableAmount: max } });
      const res = await fetch(url, { headers: { [PAYMENT_HEADER]: paymentHeader(DEMO_CHANNEL, ch.channelId, max, signature) } });
      const body = (await res.json()) as { data?: { blockNumber: string; gasPriceGwei: number }; payment?: { verifiedBy: string }; error?: string };
      if (res.status !== 200 || !body.data) throw new Error(`paid call ${n} failed with ${res.status}: ${body.error ?? "no data"}`);
      console.log(`  call ${n}: signed a voucher for ${units(max)} total -> 200 OK  block ${body.data.blockNumber}, gas ${body.data.gasPriceGwei} gwei (verified by ${body.payment?.verifiedBy})`);
      calls.push({ n, voucherTotal: units(max), status: res.status, blockNumber: body.data.blockNumber, gasPriceGwei: body.data.gasPriceGwei, verifiedBy: body.payment?.verifiedBy ?? "" });
      last = { max, signature };
      if (n < CALLS) await new Promise((r) => setTimeout(r, 1200));
    }

    // ---- The vendor gets paid on chain from the escrow the vault put up.
    console.log("\nVendor: claim the last voucher and settle");
    const before = await read<bigint>(TOKEN, TOKEN_ABI, "balanceOf", [VENDOR]);
    await step(`vendor claims the agent's voucher for ${units(last.max)} total`,
      await write(vendor, SETTLEMENT, SETTLEMENT_ABI, "claim", [[{ voucher: { channel: DEMO_CHANNEL, maxClaimableAmount: last.max }, signature: last.signature, totalClaimed: last.max }]]));
    await step("vendor settles the claimed funds to itself", await write(vendor, SETTLEMENT, SETTLEMENT_ABI, "settle", [VENDOR, TOKEN]));
    const after = await channelState(pub, DEMO_CHANNEL);

    const summary = {
      paidCalls: calls.length,
      pricePerCallAusd: units(PRICE),
      vendorReceivedAusd: units((await read<bigint>(TOKEN, TOKEN_ABI, "balanceOf", [VENDOR])) - before),
      agentOwnFundsAusd: units(await read<bigint>(TOKEN, TOKEN_ABI, "balanceOf", [AGENT])),
      agentDebtAusd: units(await read<bigint>(VAULT, VAULT_ABI, "debtOf", [SPONSOR, AGENT])),
      channelEscrowLeftAusd: units(after.balance - after.totalClaimed),
      channelTotalClaimedAusd: units(after.totalClaimed),
    };
    console.log(JSON.stringify(summary, null, 2));
    if (summary.agentOwnFundsAusd !== "0.00") throw new Error("the agent ended up holding stablecoin");
    if (BigInt(Math.round(Number(summary.vendorReceivedAusd) * 1e6)) !== PRICE * BigInt(CALLS)) throw new Error(`the vendor received ${summary.vendorReceivedAusd}, expected ${units(PRICE * BigInt(CALLS))}`);

    if (!DRY) {
      const file = path.join(root, "AGENT_RUN.json");
      const prev = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
      const out = {
        generatedAt: new Date().toISOString(), network: "Monad Testnet", chainId: 10143, vendorUrl: url,
        agent: AGENT, vendor: VENDOR, sponsor: SPONSOR, channelId: ch.channelId,
        note: "A scripted agent and a test token. Vouchers are verified by Monad's hosted x402 facilitator; the vendor claims on chain itself. The HTTP calls and every transaction below are real.",
        calls, summary,
        // Setup transactions happen once; keep them from the first run so the record stays complete.
        transactions: [...((prev.transactions ?? []) as typeof tx).filter((t) => /^(mint|sponsor)/.test(t.step) && !tx.some((n) => n.step === t.step)), ...tx],
      };
      fs.writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
    }
    console.log(`${DRY ? "dry run" : "live run"} ok: ${calls.length} paid HTTP calls, ${tx.length} transactions${DRY ? " (nothing written)" : " -> AGENT_RUN.json"}`);
  } finally {
    server?.close();
    anvil?.kill();
  }
}

main().catch((e) => { console.error(`agent FAILED: ${(e as Error).message}`); process.exit(1); });
