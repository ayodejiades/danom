/**
 * tools/verify-deployment.ts — read only check that what .kit/deployment.json says is on Monad testnet
 * really is: both deployment transactions succeeded, both contracts have code, and the vault points at
 * the canonical x402 contract and the recorded token. Sends no transaction and needs no key.
 * Usage: pnpm deploy:verify
 */
import fs from "node:fs";
import path from "node:path";
import { createPublicClient, http, parseAbi, type Hex } from "viem";
import { monadTestnet } from "viem/chains";

export async function verifyDeployment(rpc = process.env.MONAD_RPC ?? "https://testnet-rpc.monad.xyz") {
  const d = JSON.parse(fs.readFileSync(path.join(process.cwd(), ".kit", "deployment.json"), "utf8"));
  const pub = createPublicClient({ chain: monadTestnet, transport: http(rpc, { timeout: 10_000 }) });
  const checks: { check: string; ok: boolean }[] = [];
  const rc = async (h: Hex) => (await pub.getTransactionReceipt({ hash: h })).status === "success";
  checks.push({ check: "vault deployment transaction succeeded", ok: await rc(d.txHash) });
  checks.push({ check: "token deployment transaction succeeded", ok: await rc(d.token.txHash) });
  const has = async (a: Hex) => ((await pub.getCode({ address: a })) ?? "0x") !== "0x";
  checks.push({ check: "vault has code", ok: await has(d.contractAddress) });
  checks.push({ check: "token has code", ok: await has(d.token.address) });
  const abi = parseAbi(["function settlement() view returns (address)", "function token() view returns (address)"]);
  const settlement = await pub.readContract({ address: d.contractAddress, abi, functionName: "settlement" });
  const token = await pub.readContract({ address: d.contractAddress, abi, functionName: "token" });
  checks.push({ check: "vault points at the canonical x402 contract", ok: settlement.toLowerCase() === d.x402BatchSettlement.toLowerCase() });
  checks.push({ check: "vault points at the recorded token", ok: token.toLowerCase() === d.token.address.toLowerCase() });
  return { chainId: await pub.getChainId(), checks };
}

if (process.argv[1]?.endsWith("verify-deployment.ts")) {
  verifyDeployment().then(({ chainId, checks }) => {
    for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.check}`);
    console.log(`chain id ${chainId}`);
    process.exit(checks.every((c) => c.ok) && chainId === 10143 ? 0 : 1);
  }).catch((e) => { console.error("deploy:verify could not run:", (e as Error).message); process.exit(2); });
}
