// lib/x402.ts — the paid endpoint's protocol, shared by the vendor route, the agent CLI and the browser.
//
// The loop is HTTP 402 in the x402 shape: the vendor answers an unpaid request with 402 and its payment
// requirements, the agent retries with a signed cumulative voucher in the payment header, and the vendor
// checks that voucher against the real x402 batch settlement contract on Monad testnet before it serves.
//
// The payment payload follows the x402 batch-settlement EVM scheme, and the vendor has Monad's hosted
// x402 facilitator verify every voucher before it serves.
//
// Limits, stated once: the facilitator verifies but does not settle (the vendor claims on chain itself),
// the vault funds the channel directly instead of through the scheme's deposit payload, and this demo
// vendor keeps no state between requests, so it does not remember the highest voucher it has seen.
import { type Abi, type Hex, type PublicClient, parseAbi, verifyTypedData } from "viem";

export const CHAIN_ID = 10143;
export const NETWORK = "eip155:10143";
export const RPC_URL = "https://testnet-rpc.monad.xyz";
export const EXPLORER = "https://testnet.monadscan.com";
export const FACILITATOR_URL = "https://x402-facilitator.molandak.org";

export const VAULT = "0x959c59B1a46545e6AE2Fcba48A37bD93D93787dD" as Hex;
export const TOKEN = "0xffAA4a80Ce47071CC880632be756EBA0cF363F27" as Hex;
export const SETTLEMENT = "0x4020074e9dF2ce1deE5A9C1b5c3f541D02a10003" as Hex;
export const SPONSOR = "0x5950Cf8500c45cFaE8fA1eCD242a4469Bd5951Ff" as Hex;

// The vendor that sells the data. Its key stays private; only the address is public.
export const VENDOR = "0x4466592e02a5932E8FCf0614b4034389DAcedaBc" as Hex;

// The demo agent's signing key is PUBLIC ON PURPOSE. It is the point of the product: this key can sign
// vouchers and ask the vault for funding, and the vault will only ever pay the vendor the sponsor
// approved, inside the caps the sponsor set. Anyone may use it. It holds no stablecoin.
export const AGENT_KEY = "0xad7c0fec030bf44a0644e3c4905dd827d75a9b9371a4c23d7d6aecf1595f4007" as Hex;
export const AGENT = "0xEc7029cb006e7F5cC128b0060009332eB8c76D6e" as Hex;

export const PRICE = BigInt(250_000); // 0.25 per call, 6 decimals
export const CHANNEL_DEPOSIT = BigInt(10_000_000); // the agent asks the vault for 10.00 at a time
export const WITHDRAW_DELAY = 900;
export const CHANNEL_SALT = ("0x" + "da".padStart(64, "0")) as Hex;

export interface ChannelConfig {
  payer: Hex; payerAuthorizer: Hex; receiver: Hex; receiverAuthorizer: Hex; token: Hex; withdrawDelay: number; salt: Hex;
}

/** The one channel the demo agent pays the vendor through: the vault is the payer, the agent only authorizes. */
export const DEMO_CHANNEL: ChannelConfig = {
  payer: VAULT, payerAuthorizer: AGENT, receiver: VENDOR, receiverAuthorizer: VENDOR, token: TOKEN, withdrawDelay: WITHDRAW_DELAY, salt: CHANNEL_SALT,
};

const CFG = "(address payer,address payerAuthorizer,address receiver,address receiverAuthorizer,address token,uint40 withdrawDelay,bytes32 salt)";
export const SETTLEMENT_ABI = parseAbi([
  `function getChannelId(${CFG} config) view returns (bytes32)`,
  "function channels(bytes32) view returns (uint128 balance, uint128 totalClaimed)",
  `function claim(((${CFG} channel,uint128 maxClaimableAmount) voucher,bytes signature,uint128 totalClaimed)[] claims)`,
  "function settle(address receiver, address token)",
]) as unknown as Abi;

export const VAULT_ABI = parseAbi([
  "function fundChannel(address sponsor,address receiver,uint40 withdrawDelay,bytes32 salt,uint128 amount) returns (bytes32)",
  "function openLine(address agent,uint128 collateral,uint128 baseLimit,uint128 perBorrowCap,uint32 aprBps,uint64 durationSeconds,uint32 repayShareBps)",
  "function setVendor(address agent,address receiver,address receiverAuthorizer)",
  "function lines(address,address) view returns (bool active,uint128 collateral,uint128 baseLimit,uint128 perBorrowCap,uint128 principal,uint128 interestOwed,uint32 aprBps,uint32 repayShareBps,uint64 lastAccrual,uint64 dueAt)",
  "function receiverAuthorizerOf(address,address,address) view returns (address)",
  "function debtOf(address sponsor,address agent) view returns (uint256)",
  "function creditLimit(address sponsor,address agent) view returns (uint256)",
  "error ZeroAmount()", "error LineExists()", "error LineInactive()", "error LineExpired()", "error ReceiverNotAllowed()",
  "error OverPerBorrowCap()", "error OverCreditLimit()", "error InsufficientCash()", "error BadTerms()",
]) as unknown as Abi;

export const TOKEN_ABI = parseAbi([
  "function mint(address to,uint256 amount)",
  "function approve(address spender,uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
]) as unknown as Abi;

export const VOUCHER_DOMAIN = { name: "x402 Batch Settlement", version: "1", chainId: CHAIN_ID, verifyingContract: SETTLEMENT } as const;
export const VOUCHER_TYPES = { Voucher: [{ name: "channelId", type: "bytes32" }, { name: "maxClaimableAmount", type: "uint128" }] } as const;

export interface Accepted {
  scheme: "batch-settlement"; network: string; amount: string; asset: Hex; payTo: Hex; maxTimeoutSeconds: number;
  extra: { receiverAuthorizer: Hex; withdrawDelay: number; name: string; version: string; minDeposit: string };
}

/** The one thing this vendor sells, in the scheme's PaymentRequirements shape. */
export const ACCEPTED: Accepted = {
  scheme: "batch-settlement", network: NETWORK, amount: PRICE.toString(), asset: TOKEN, payTo: VENDOR, maxTimeoutSeconds: 60,
  extra: { receiverAuthorizer: VENDOR, withdrawDelay: WITHDRAW_DELAY, name: "MockAUSD", version: "1", minDeposit: (PRICE * BigInt(10)).toString() },
};

/** What the agent puts in the payment header: a batch-settlement `voucher` payload. */
export interface PaymentPayload {
  x402Version: 2;
  accepted: Accepted;
  payload: { type: "voucher"; channelConfig: ChannelConfig; voucher: { channelId: Hex; maxClaimableAmount: string; signature: Hex } };
}

export const PAYMENT_REQUIRED_HEADER = "PAYMENT-REQUIRED";
export const PAYMENT_HEADER = "PAYMENT-SIGNATURE";
export const PAYMENT_RESPONSE_HEADER = "PAYMENT-RESPONSE";

const toB64 = (s: string) => (typeof btoa === "function" ? btoa(s) : Buffer.from(s, "utf8").toString("base64"));
const fromB64 = (s: string) => (typeof atob === "function" ? atob(s) : Buffer.from(s, "base64").toString("utf8"));
export const encodeHeader = (value: unknown) => toB64(JSON.stringify(value));
export const decodeHeader = <T,>(value: string) => JSON.parse(fromB64(value)) as T;

export const units = (n: bigint) => `${n / BigInt(1_000_000)}.${(n % BigInt(1_000_000)).toString().padStart(6, "0").slice(0, 2)}`;

export function paymentPayload(channelConfig: ChannelConfig, channelId: Hex, maxClaimableAmount: bigint, signature: Hex): PaymentPayload {
  return { x402Version: 2, accepted: ACCEPTED, payload: { type: "voucher", channelConfig, voucher: { channelId, maxClaimableAmount: maxClaimableAmount.toString(), signature } } };
}
export const paymentHeader = (channelConfig: ChannelConfig, channelId: Hex, maxClaimableAmount: bigint, signature: Hex) =>
  encodeHeader(paymentPayload(channelConfig, channelId, maxClaimableAmount, signature));

export async function channelState(pub: PublicClient, channel: ChannelConfig) {
  const channelId = (await pub.readContract({ address: SETTLEMENT, abi: SETTLEMENT_ABI, functionName: "getChannelId", args: [channel] })) as Hex;
  const [balance, totalClaimed] = (await pub.readContract({ address: SETTLEMENT, abi: SETTLEMENT_ABI, functionName: "channels", args: [channelId] })) as [bigint, bigint];
  return { channelId, balance, totalClaimed };
}

/** The 402 body: what the vendor sells, what it costs, and where the payment has to be escrowed. */
export function paymentRequirements(resourceUrl: string, error?: string) {
  return {
    x402Version: 2,
    error: error ?? "Payment required",
    resource: { url: resourceUrl, description: "Monad testnet gas and block report", mimeType: "application/json" },
    accepts: [ACCEPTED],
  };
}

/** Ask Monad's hosted x402 facilitator whether the voucher is valid for these requirements. */
export async function facilitatorVerify(payload: PaymentPayload): Promise<{ reached: boolean; isValid?: boolean; invalidReason?: string }> {
  try {
    const r = await fetch(`${FACILITATOR_URL}/verify`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ x402Version: 2, paymentPayload: payload, paymentRequirements: ACCEPTED }),
      signal: AbortSignal.timeout(8000),
    });
    const j = (await r.json()) as { isValid?: boolean; invalidReason?: string };
    return { reached: true, isValid: Boolean(j.isValid), invalidReason: j.invalidReason };
  } catch {
    return { reached: false };
  }
}

export interface VendorReply { status: number; headers: Record<string, string>; body: unknown }

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * The vendor. No header: 402 with the price. A header: have the facilitator verify the voucher, check on
 * chain that the channel's escrow covers it, then serve the data. Used by the Next route and by the agent
 * CLI's rehearsal server, so both run this code. `useFacilitator` is off on a local fork, which the hosted
 * facilitator cannot see.
 */
export async function handleVendorRequest(pub: PublicClient, header: string | null, resourceUrl: string, useFacilitator = true): Promise<VendorReply> {
  const refuse = (error?: string): VendorReply => {
    const body = paymentRequirements(resourceUrl, error);
    return { status: 402, headers: { [PAYMENT_REQUIRED_HEADER]: encodeHeader(body) }, body };
  };
  if (!header) return refuse();

  let p: PaymentPayload;
  try { p = decodeHeader<PaymentPayload>(header); } catch { return refuse("The payment header is not base64 JSON"); }
  const c = p?.payload?.channelConfig;
  const v = p?.payload?.voucher;
  if (p?.payload?.type !== "voucher" || !c || !v?.signature || p?.accepted?.scheme !== "batch-settlement" || p?.accepted?.network !== NETWORK) return refuse("Unsupported scheme, network or payload");
  if (!same(c.receiver, VENDOR) || !same(c.receiverAuthorizer, VENDOR)) return refuse("This channel does not pay this vendor");
  if (!same(c.token, TOKEN)) return refuse("Wrong token");

  let max: bigint;
  try { max = BigInt(v.maxClaimableAmount); } catch { return refuse("maxClaimableAmount is not a number"); }

  const { channelId, balance, totalClaimed } = await channelState(pub, c);
  if (!same(v.channelId, channelId)) return refuse("The voucher's channelId does not match its channel config");

  let verifiedBy = "the vendor's own check against the settlement contract";
  const fac = useFacilitator ? await facilitatorVerify(p) : { reached: false };
  if (fac.reached) {
    if (!fac.isValid) return refuse(`The x402 facilitator rejected the voucher: ${fac.invalidReason ?? "invalid"}`);
    verifiedBy = `the x402 facilitator at ${new URL(FACILITATOR_URL).host}`;
  } else {
    const signed = await verifyTypedData({
      address: c.payerAuthorizer, domain: VOUCHER_DOMAIN, types: VOUCHER_TYPES, primaryType: "Voucher",
      message: { channelId, maxClaimableAmount: max }, signature: v.signature,
    }).catch(() => false);
    if (!signed) return refuse("The voucher was not signed by the channel's payerAuthorizer");
    if (max < totalClaimed + PRICE) return refuse(`The voucher must authorize at least ${units(totalClaimed + PRICE)} in total (claimed so far ${units(totalClaimed)} plus the ${units(PRICE)} price)`);
  }
  // `balance` is everything ever deposited into the channel; what is left to spend is balance minus totalClaimed.
  if (max > balance) return refuse(`The channel escrow (${units(balance - totalClaimed)} left) does not cover this voucher. The agent must ask the vault to fund the channel`);

  const [block, gasPrice] = await Promise.all([pub.getBlock(), pub.getGasPrice()]);
  const receipt = { success: true, network: NETWORK, payer: c.payer, channelId, accepted: max.toString(), price: PRICE.toString(), verifiedBy };
  return {
    status: 200,
    headers: { [PAYMENT_RESPONSE_HEADER]: encodeHeader(receipt) },
    body: {
      data: {
        chainId: CHAIN_ID,
        blockNumber: block.number.toString(),
        blockTime: new Date(Number(block.timestamp) * 1000).toISOString(),
        transactionsInBlock: block.transactions.length,
        gasUsed: block.gasUsed.toString(),
        gasPriceGwei: Number(gasPrice) / 1e9,
        costOf800kGasCallMon: (Number(gasPrice) * 800_000) / 1e18,
      },
      payment: { ...receipt, escrowLeft: (balance - max).toString(), paidBy: "CreditVault escrow, authorized by the agent's voucher" },
    },
  };
}
