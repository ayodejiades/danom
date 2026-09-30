/**
 * tools/keys-generate.ts — Generates 3 deterministic/fresh operator wallets
 * (DEPLOYER, OPERATOR, VERIFIER) for multi-account on-chain proof runs.
 * Usage: pnpm keys:generate
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { privateKeyToAccount } from "viem/accounts";

const envPath = path.join(process.cwd(), ".env");
const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

function genKey(role: string): { priv: `0x${string}`; address: string } {
  const priv = (`0x${crypto.randomBytes(32).toString("hex")}`) as `0x${string}`;
  const acct = privateKeyToAccount(priv);
  return { priv, address: acct.address };
}

const roles = ["DEPLOYER", "AI_VERIFIER", "DEMO_OPERATOR"] as const;
const lines = existing ? existing.trimEnd().split("\n") : [];

console.log("================================================================================");
console.log("MULTI-PARTY PROOF KEY GENERATOR (DEPLOYER / AI_VERIFIER / DEMO_OPERATOR)");
console.log("================================================================================");

for (const role of roles) {
  const keyVar = `${role}_PRIVATE_KEY`;
  const addrVar = `${role}_ADDRESS`;
  const hasKey = lines.some((l) => l.startsWith(`${keyVar}=`));
  if (hasKey) {
    const existingAddr = lines.find((l) => l.startsWith(`${addrVar}=`))?.split("=")[1] ?? "(existing)";
    console.log(`[SKIP] ${role.padEnd(15)} already present in .env -> ${existingAddr}`);
    continue;
  }
  const { priv, address } = genKey(role);
  lines.push(`${keyVar}=${priv}`);
  lines.push(`${addrVar}=${address}`);
  console.log(`[NEW]  ${role.padEnd(15)} address: ${address}`);
}

fs.writeFileSync(envPath, lines.join("\n") + "\n");
console.log("--------------------------------------------------------------------------------");
console.log("Keys written to .env (git-ignored). Ready for multi-wallet proof execution.");
