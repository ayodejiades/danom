/**
 * tools/local-proof.ts — runs CreditVault against the REAL x402BatchSettlement contract on an Anvil
 * fork of Monad testnet, and records exactly what happened: real transaction hashes, real logs and
 * the real reverts.
 *
 * What is real: the x402 batch settlement contract (canonical address, forked from Monad testnet)
 * and its EIP-712 voucher checks. What is not: the token is our MockAUSD, state changes stay in the
 * local fork and are never broadcast to Monad, and no facilitator is involved (the vendor claims
 * directly as receiver authorizer). The mode is written as "ANVIL_FORK_MONAD_TESTNET".
 *
 * Usage: pnpm proof:local   (needs `forge build`, `anvil` on PATH, and network access to the Monad RPC)
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  createPublicClient, createTestClient, createWalletClient, http, parseAbi, decodeEventLog,
  BaseError, ContractFunctionRevertedError, type Abi, type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";
import { fromUnits, receiptDigest, toUnits } from "../lib/stream";

const PORT = 8547;
const RPC = `http://127.0.0.1:${PORT}`;
const FORK_URL = process.env.MONAD_RPC ?? "https://testnet-rpc.monad.xyz";
const SETTLEMENT = "0x4020074e9dF2ce1deE5A9C1b5c3f541D02a10003" as const;

// Throwaway keys, generated fresh each run; funded with gas only inside the local fork.
const K = {
  lender: generatePrivateKey(), sponsor: generatePrivateKey(), sponsor2: generatePrivateKey(),
  agent: generatePrivateKey(), vendor: generatePrivateKey(), vendorAuth: generatePrivateKey(),
  customer: generatePrivateKey(), keeper: generatePrivateKey(), fresh: generatePrivateKey(),
};

const CFG = "(address payer,address payerAuthorizer,address receiver,address receiverAuthorizer,address token,uint40 withdrawDelay,bytes32 salt)";
const SETTLEMENT_ABI = parseAbi([
  `function getChannelId(${CFG} config) view returns (bytes32)`,
  "function channels(bytes32) view returns (uint128 balance, uint128 totalClaimed)",
  `function claim((( ${CFG} channel,uint128 maxClaimableAmount) voucher,bytes signature,uint128 totalClaimed)[] claims)`,
  "function settle(address receiver, address token)",
  `function refund(${CFG} config, uint128 amount)`,
  "error InvalidSignature()",
  "error ClaimExceedsBalance()",
  "error ClaimExceedsCeiling()",
]);
const SETTLEMENT_EVENTS = parseAbi([
  "event Deposited(bytes32 indexed channelId, address indexed sender, uint128 amount, uint128 newBalance)",
  "event Claimed(bytes32 indexed channelId, address indexed sender, uint128 claimAmount, uint128 newTotalClaimed)",
  "event Settled(address indexed receiver, address indexed token, address indexed sender, uint128 amount)",
  "event Refunded(bytes32 indexed channelId, address indexed sender, uint128 amount)",
]);

function artifact(name: string): { abi: Abi; bytecode: Hex } {
  const p = path.join(process.cwd(), "contracts", "out", `${name}.sol`, `${name}.json`);
  if (!fs.existsSync(p)) throw new Error(`missing ${p}: run \`forge build\` first`);
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  return { abi: j.abi as Abi, bytecode: j.bytecode.object as Hex };
}

async function waitForRpc() {
  for (let i = 0; i < 150; i++) {
    try {
      const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' });
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("anvil did not start (is the Monad RPC reachable?)");
}

function revertName(err: unknown): string {
  if (err instanceof BaseError) {
    const inner = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (inner instanceof ContractFunctionRevertedError) return inner.data?.errorName ?? inner.reason ?? "reverted";
  }
  return "reverted";
}

const salt = (n: number) => ("0x" + n.toString(16).padStart(64, "0")) as Hex;
const VOUCHER_TYPES = { Voucher: [{ name: "channelId", type: "bytes32" }, { name: "maxClaimableAmount", type: "uint128" }] } as const;

async function main() {
  const anvil = spawn("anvil", ["--fork-url", FORK_URL, "--port", String(PORT), "--silent"], { stdio: "ignore" });
  try {
    await waitForRpc();
    const chain = { ...monadTestnet, rpcUrls: { default: { http: [RPC] } } } as unknown as typeof monadTestnet;
    const pub = createPublicClient({ chain, transport: http(RPC) });
    const test = createTestClient({ chain, mode: "anvil", transport: http(RPC) });
    const mk = (k: Hex) => createWalletClient({ account: privateKeyToAccount(k), chain, transport: http(RPC) });
    const W = Object.fromEntries(Object.entries(K).map(([n, k]) => [n, mk(k as Hex)])) as Record<keyof typeof K, ReturnType<typeof mk>>;
    for (const w of Object.values(W)) await test.setBalance({ address: w.account.address, value: BigInt(10) ** BigInt(18) });
    const A = (n: keyof typeof K) => W[n].account.address;

    const forkBlock = await pub.getBlockNumber(); // only query logs from here: the public RPC caps eth_getLogs ranges
    const code = await pub.getCode({ address: SETTLEMENT });
    if (!code || code === "0x") throw new Error("x402BatchSettlement has no code on this fork");

    const txs: { step: string; hash: Hex; block: string }[] = [];
    const send = async (step: string, hash: Hex) => {
      const rc = await pub.waitForTransactionReceipt({ hash });
      if (rc.status !== "success") {
        const tx = await pub.getTransaction({ hash });
        let why = "unknown";
        try { await pub.call({ account: tx.from, to: tx.to!, data: tx.input, blockNumber: rc.blockNumber - BigInt(1) }); } catch (e) { why = (e as Error).message.split("\n")[0]; }
        throw new Error(`${step} failed (gas used ${rc.gasUsed} of ${tx.gas}; replay says: ${why})`);
      }
      txs.push({ step, hash, block: rc.blockNumber.toString() });
      return rc;
    };

    const tokenA = artifact("MockAUSD");
    const vaultA = artifact("CreditVault");
    const deploy = async (name: string, a: { abi: Abi; bytecode: Hex }, args: unknown[] = []) =>
      (await send(`deploy ${name}`, await W.lender.deployContract({ abi: a.abi, bytecode: a.bytecode, args }))).contractAddress as Hex;
    const ausd = await deploy("MockAUSD (stand in for the real stablecoin)", tokenA);
    const vault = await deploy("CreditVault", vaultA, [SETTLEMENT, ausd]);

    type Client = (typeof W)[keyof typeof W];
    const XA = SETTLEMENT_ABI as unknown as Abi;
    const write = (c: Client, address: Hex, abi: Abi, fn: string, args: unknown[]) => c.writeContract({ address, abi, functionName: fn, args, gas: BigInt(3_000_000) } as never);
    const V = (c: Client, fn: string, args: unknown[]) => write(c, vault, vaultA.abi, fn, args);
    const read = async <T,>(address: Hex, abi: Abi, fn: string, args: unknown[] = []) => (await pub.readContract({ address, abi, functionName: fn, args })) as T;
    const rv = <T,>(fn: string, args: unknown[] = []) => read<T>(vault, vaultA.abi, fn, args);
    const bal = (who: Hex) => read<bigint>(ausd, tokenA.abi, "balanceOf", [who]);
    const adv = async (seconds: number) => { await test.increaseTime({ seconds }); await test.mine({ blocks: 1 }); };

    const S = A("sponsor"), S2 = A("sponsor2"), AG = A("agent"), VN = A("vendor"), VA = A("vendorAuth"), C = A("customer");
    const chainId = await pub.getChainId();

    // ---- fund and approve
    for (const [who, amt] of [["lender", 10000], ["sponsor", 2000], ["sponsor2", 500], ["customer", 5000]] as const)
      await send(`mint ${amt} to ${who}`, await write(W.lender, ausd, tokenA.abi, "mint", [A(who), toUnits(amt)]));
    for (const who of ["lender", "sponsor", "sponsor2", "customer", "agent"] as const)
      await send(`${who} approves the vault`, await write(W[who], ausd, tokenA.abi, "approve", [vault, toUnits(1_000_000)]));

    // ---- run 1: line, channel, real voucher, claim, settle, refund, reconcile
    await send("lender supplies 5000", await V(W.lender, "supply", [toUnits(5000)]));
    await send("sponsor opens line: 400 collateral, 100 base, 40 per channel, 10% APR, 30 days, 50% revenue share",
      await V(W.sponsor, "openLine", [AG, toUnits(400), toUnits(100), toUnits(40), 1000, BigInt(30 * 86400), 5000]));
    await send("sponsor allowlists the vendor and its claim authorizer", await V(W.sponsor, "setVendor", [AG, VN, VA]));
    await send("sponsor allowlists the customer as a revenue payer", await V(W.sponsor, "setRevenuePayer", [AG, C, true]));

    const config = (s: number) => ({ payer: vault, payerAuthorizer: AG, receiver: VN, receiverAuthorizer: VA, token: ausd, withdrawDelay: 900, salt: salt(s) });
    const chId = (s: number) => read<Hex>(SETTLEMENT, XA, "getChannelId", [config(s)]);
    const domain = { name: "x402 Batch Settlement", version: "1", chainId, verifyingContract: SETTLEMENT } as const;
    const signVoucher = (signer: Client, id: Hex, max: bigint) =>
      signer.account!.signTypedData({ domain, types: VOUCHER_TYPES, primaryType: "Voucher", message: { channelId: id, maxClaimableAmount: max } });
    const claim = async (s: number, cumulative: bigint, signer: Client = W.agent) => {
      const sig = await signVoucher(signer, await chId(s), cumulative);
      return write(W.vendorAuth, SETTLEMENT, XA, "claim", [[{ voucher: { channel: config(s), maxClaimableAmount: cumulative }, signature: sig, totalClaimed: cumulative }]]);
    };
    const settle = async () => send("anyone settles claimed funds to the vendor", await write(W.keeper, SETTLEMENT, XA, "settle", [VN, ausd]));
    const fund = (s: number, amt: number | string, sponsor: Hex = S) => V(W.agent, "fundChannel", [sponsor, VN, 900, salt(s), toUnits(amt)]);

    const agentTokensBefore = await bal(AG);
    await send("agent funds a 40 channel for the vendor (vault pays, agent holds nothing)", await fund(1, 40));
    const id1 = await chId(1);
    const [escrow1] = await read<[bigint, bigint]>(SETTLEMENT, XA, "channels", [id1]);
    const debtAfterFund = await rv<bigint>("debtOf", [S, AG]);
    await send("vendor claims a voucher for 12.30", await claim(1, 12_300_000n));
    await settle();
    await send("vendor claims a later voucher for 25", await claim(1, toUnits(25)));
    await settle();
    const vendorGot = await bal(VN);
    await send("vendor refunds the 15 it did not use (goes straight to the vault)", await write(W.vendorAuth, SETTLEMENT, XA, "refund", [config(1), toUnits(15)]));
    const unbooked = (await bal(vault)) - (await rv<bigint>("accounted"));
    const navBefore = await rv<bigint>("totalAssets");
    await send("anyone reconciles the refund: debt drops by 15", await write(W.keeper, vault, vaultA.abi, "reconcile", [config(1)]));
    const navAfter = await rv<bigint>("totalAssets");
    const debtAfterReconcile = await rv<bigint>("debtOf", [S, AG]);

    // ---- run 2: repay, graduate, record
    const [, , , tierBefore, ltvBefore] = await rv<[bigint, bigint, bigint, bigint, bigint]>("recordOf", [AG]);
    const limitBefore = await rv<bigint>("creditLimit", [S, AG]);
    await send("sponsor repays the outstanding 25", await V(W.sponsor, "repay", [S, AG, toUnits(25)]));
    for (let i = 0; i < 3; i++) {
      await send(`agent funds a 40 channel (round ${i + 1})`, await fund(10 + i, 40));
      await send(`vendor claims 40 (round ${i + 1})`, await claim(10 + i, toUnits(40)));
      await settle();
      await send(`sponsor repays 40 (round ${i + 1})`, await V(W.sponsor, "repay", [S, AG, toUnits(40)]));
    }
    const [repaid1, , , tierAfter, ltvAfter] = await rv<[bigint, bigint, bigint, bigint, bigint]>("recordOf", [AG]);
    const limitAfter = await rv<bigint>("creditLimit", [S, AG]);

    // ---- run 3: revenue routing
    await send("agent funds a 40 channel to have debt", await fund(20, 40));
    const debtBeforeRev = await rv<bigint>("debtOf", [S, AG]);
    const agentBeforeRev = await bal(AG);
    await send("customer pays the agent 100 through the vault", await V(W.customer, "receiveRevenue", [S, AG, toUnits(100)]));
    const agentGotRev = (await bal(AG)) - agentBeforeRev;
    const debtAfterRev = await rv<bigint>("debtOf", [S, AG]);

    // ---- refusals from the vault and from the real x402 contract
    const refusals: { attempt: string; expected: string; refusedWith: string }[] = [];
    const sim = async (attempt: string, expected: string, address: Hex, abi: Abi, fn: string, args: unknown[], account: Hex) => {
      let got = "NOT_REFUSED";
      try { await pub.simulateContract({ address, abi, functionName: fn, args, account }); } catch (e) { got = revertName(e); }
      refusals.push({ attempt, expected, refusedWith: got });
    };
    const fundArgs = (rcv: Hex, s: number, amt: number) => [S, rcv, 900, salt(s), toUnits(amt)];
    await sim("agent tries to fund a channel paying itself", "ReceiverNotAllowed", vault, vaultA.abi, "fundChannel", fundArgs(AG, 90, 10), AG);
    await sim("agent tries to fund a wallet the sponsor never approved", "ReceiverNotAllowed", vault, vaultA.abi, "fundChannel", fundArgs(A("keeper"), 91, 10), AG);
    await sim("agent funds 41 (cap is 40)", "OverPerBorrowCap", vault, vaultA.abi, "fundChannel", fundArgs(VN, 92, 41), AG);
    await sim("a wallet that is not the agent funds on the agent's line", "LineInactive", vault, vaultA.abi, "fundChannel", fundArgs(VN, 93, 10), A("keeper"));
    for (let i = 0; i < 12; i++) {
      const room = (await rv<bigint>("creditLimit", [S, AG])) - (await rv<bigint>("debtOf", [S, AG]));
      if (room <= BigInt(0)) break;
      await send(`agent funds toward its credit ceiling (${i + 1})`, await V(W.agent, "fundChannel", [S, VN, 900, salt(30 + i), room > toUnits(40) ? toUnits(40) : room]));
    }
    await sim("agent funds past its credit ceiling", "OverCreditLimit", vault, vaultA.abi, "fundChannel", fundArgs(VN, 94, 5), AG);
    // a voucher signed by anyone but the agent is refused by the real x402 contract
    const id20 = await chId(20); // unclaimed escrow, so the signature is the check that fires
    const forgedSig = await signVoucher(W.keeper, id20, toUnits(10));
    await sim("vendor claims a voucher signed by someone other than the agent", "InvalidSignature", SETTLEMENT, XA, "claim",
      [[{ voucher: { channel: config(20), maxClaimableAmount: toUnits(10) }, signature: forgedSig, totalClaimed: toUnits(10) }]], VA);
    await send("sponsor revokes the line", await V(W.sponsor, "revoke", [AG]));
    await sim("agent funds after revoke", "LineInactive", vault, vaultA.abi, "fundChannel", fundArgs(VN, 95, 5), AG);

    // ---- run 4: the record follows the agent to a new sponsor; a fresh agent cannot get the same terms
    await send("sponsor2 allowlists the vendor for the proven agent", await V(W.sponsor2, "setVendor", [AG, VN, VA]));
    await sim("a fresh agent asks for the same terms (base 90 on 100 collateral)", "BadTerms", vault, vaultA.abi, "openLine",
      [A("fresh"), toUnits(100), toUnits(90), toUnits(40), 1000, BigInt(30 * 86400), 5000], S2);
    await send("sponsor2 opens the same terms for the proven agent (allowed by its tier)",
      await V(W.sponsor2, "openLine", [AG, toUnits(100), toUnits(90), toUnits(40), 1000, BigInt(30 * 86400), 5000]));
    const limitSponsor2 = await rv<bigint>("creditLimit", [S2, AG]);

    // ---- run 5: default and liquidation, record resets
    await send("agent funds 40 on sponsor2's line", await fund(40, 40, S2));
    await adv(31 * 86400);
    const debtAtLiq = await rv<bigint>("debtOf", [S2, AG]);
    const s2Before = await bal(S2);
    await send("keeper liquidates the overdue line", await write(W.keeper, vault, vaultA.abi, "liquidate", [S2, AG]));
    const returnedToS2 = (await bal(S2)) - s2Before;
    const [, , defaults, tierAfterDefault, ltvAfterDefault] = await rv<[bigint, bigint, bigint, bigint, bigint]>("recordOf", [AG]);

    // ---- logs -> receipts + fixtures
    const head = await pub.getBlockNumber();
    const events: unknown[] = [];
    const receipts: unknown[] = [];
    const vaultLogs = await pub.getLogs({ address: vault, fromBlock: forkBlock, toBlock: head });
    for (const log of vaultLogs) {
      let ev: { eventName?: string; args?: unknown };
      try { ev = decodeEventLog({ abi: vaultA.abi, data: log.data, topics: log.topics }) as never; } catch { continue; }
      const block = await pub.getBlock({ blockNumber: log.blockNumber });
      const raw = JSON.parse(JSON.stringify(ev.args ?? {}, (_k, v) => (typeof v === "bigint" ? v.toString() : v))) as Record<string, string>;
      events.push({
        blockNumber: log.blockNumber.toString(), txHash: log.transactionHash, logIndex: log.logIndex, contractAddress: log.address,
        eventName: ev.eventName, args: raw, blockTimestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
      });
      const kinds = ["ChannelFunded", "Repaid", "RevenueRouted", "Liquidated", "LineOpened", "Supplied", "SupplyWithdrawn", "ChannelReconciled"];
      if (!kinds.includes(ev.eventName as string)) continue;
      const amount = BigInt(raw.amount ?? raw.collateral ?? raw.returnedNow ?? (raw.interestPaid !== undefined ? String(BigInt(raw.interestPaid) + BigInt(raw.principalPaid)) : undefined) ?? raw.seized ?? "0");
      const from = raw.sponsor ?? raw.lender ?? raw.payer ?? vault;
      const to = raw.receiver ?? raw.agent ?? raw.lender ?? vault;
      const kind = (ev.eventName as string).toLowerCase();
      const idStr = raw.channelId ?? `${log.transactionHash}:${log.logIndex}`;
      receipts.push({
        kind, id: idStr, from, to, amountUnits: amount.toString(), amountAusd: fromUnits(amount, 2),
        txHash: log.transactionHash, blockNumber: log.blockNumber.toString(),
        digest: receiptDigest({ chainId, contract: log.address, kind, id: idStr, from, to, amount, txHash: log.transactionHash }),
      });
    }
    const x402Logs = await pub.getLogs({ address: SETTLEMENT, fromBlock: forkBlock, toBlock: head });
    const x402Events = x402Logs.flatMap((l) => {
      try { const e = decodeEventLog({ abi: SETTLEMENT_EVENTS, data: l.data, topics: l.topics }); return [{ event: e.eventName, tx: l.transactionHash, block: l.blockNumber.toString() }]; } catch { return []; }
    });

    const proof = {
      generatedAt: new Date().toISOString(),
      verificationMode: "ANVIL_FORK_MONAD_TESTNET",
      note: "CreditVault run against the real x402BatchSettlement contract on a local Anvil fork of Monad testnet. State changes stay in the fork; nothing was broadcast to Monad. The token is MockAUSD. No facilitator was involved.",
      chainId,
      forkedFrom: FORK_URL,
      contracts: { MockAUSD: ausd, CreditVault: vault, x402BatchSettlement: SETTLEMENT },
      accounts: { lender: A("lender"), sponsor: S, sponsor2: S2, agent: AG, vendor: VN, vendorAuthorizer: VA, customer: C, keeper: A("keeper") },
      runs: [
        { id: "run-01-channel", title: "Vault funds an x402 channel; agent signs vouchers; vendor claims; vendor refunds; reconcile books it",
          agentTokensChangeAusd: fromUnits((await bal(AG)) - agentTokensBefore - agentGotRev, 2),
          escrowedAusd: fromUnits(escrow1, 2), debtAfterFundAusd: fromUnits(debtAfterFund, 2),
          vendorReceivedAusd: fromUnits(vendorGot, 2), unbookedRefundAusd: fromUnits(unbooked, 2),
          shareValueBeforeReconcileAusd: fromUnits(navBefore, 2), shareValueAfterReconcileAusd: fromUnits(navAfter, 2),
          debtAfterReconcileAusd: fromUnits(debtAfterReconcile, 2) },
        { id: "run-02-graduation", title: "Repayments raise the agent's tier; collateral supports more credit",
          tierBefore: Number(tierBefore), tierAfter: Number(tierAfter), ltvBpsBefore: Number(ltvBefore), ltvBpsAfter: Number(ltvAfter),
          repaidPrincipalAusd: fromUnits(repaid1, 2), creditLimitBeforeAusd: fromUnits(limitBefore, 2), creditLimitAfterAusd: fromUnits(limitAfter, 2) },
        { id: "run-03-revenue", title: "A customer pays the agent through the vault; the loan is repaid first",
          debtBeforeAusd: fromUnits(debtBeforeRev, 2), customerPaidAusd: "100.00", agentReceivedAusd: fromUnits(agentGotRev, 2), debtAfterAusd: fromUnits(debtAfterRev, 2) },
        { id: "run-04-portable-record", title: "The record follows the agent to a new sponsor",
          sponsor2CreditLimitAusd: fromUnits(limitSponsor2, 2) },
        { id: "run-05-default", title: "An overdue line is liquidated; the default pins the agent to tier 0",
          debtAtLiquidationAusd: fromUnits(debtAtLiq, 2), returnedToSponsorAusd: fromUnits(returnedToS2, 2),
          defaults: Number(defaults), tierAfter: Number(tierAfterDefault), ltvBpsAfter: Number(ltvAfterDefault) },
        { id: "refusals", title: "Attempts refused by the vault or the real x402 contract", refusals },
      ],
      x402Events,
      transactions: txs,
      receipts,
    };
    fs.writeFileSync(path.join(process.cwd(), "PROOF_RUNS.json"), JSON.stringify(proof, null, 2) + "\n");
    fs.mkdirSync(path.join(process.cwd(), "fixtures"), { recursive: true });
    fs.writeFileSync(path.join(process.cwd(), "fixtures", "events.json"), JSON.stringify(events, null, 2) + "\n");
    console.log(`proof:local ok — ${txs.length} txs, ${events.length} vault events, ${x402Events.length} x402 events, ${refusals.filter((r) => r.expected === r.refusedWith).length}/${refusals.length} refusals matched`);
  } finally {
    anvil.kill();
  }
}

main().catch((e) => { console.error("proof:local FAILED:", e); process.exit(1); });
