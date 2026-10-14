// lib/seams.ts — every outside dependency, with the status it really has today. claim:verify writes this
// table into docs/SPONSOR_INTEGRATIONS.md, so the docs cannot say more than this file does.
export type SeamStatus = "REAL_ON_TESTNET" | "REAL_ON_FORK" | "BUILT_UNTESTED_LIVE" | "NOT_INTEGRATED" | "NOT_PLANNED";

export interface Seam {
  name: string;
  role: string;
  status: SeamStatus;
  codePath: string;
  evidence: string;
  notClaimed: string;
}

export const SEAMS: Seam[] = [
  {
    name: "x402 batch settlement (canonical contract on Monad)",
    role: "Escrow, cumulative vouchers, claim, settle and refund for every payment the agent makes.",
    status: "REAL_ON_TESTNET",
    codePath: "contracts/src/CreditVault.sol, contracts/src/interfaces/IX402BatchSettlement.sol",
    evidence: "Contract at 0x4020074e9dF2ce1deE5A9C1b5c3f541D02a10003 has code on Monad testnet (10143) and mainnet (143). Fork tests and tools/local-proof.ts run the vault against it on an Anvil fork, and tools/live-run.ts ran one full cycle against it on Monad testnet (LIVE_RUN.json).",
    notClaimed: "The testnet run is one scripted cycle with test tokens. The longer recorded run, with tier graduation and liquidation, happened on a local fork.",
  },
  {
    name: "Monad x402 facilitator",
    role: "Hosted verify and settle service that would relay deposits, claims and refunds.",
    status: "REAL_ON_TESTNET",
    codePath: "none",
    evidence: "The vendor route posts every voucher to https://x402-facilitator.molandak.org/verify and serves only when it answers isValid. A forged voucher is rejected with invalid_batch_settlement_evm_voucher_signature. See lib/x402.ts.",
    notClaimed: "Verification only. The facilitator does not settle or claim for this vendor, and the vault funds channels directly, not through a deposit payload.",
  },
  {
    name: "Dynamic",
    role: "Planned: embedded wallet for the sponsor and the agent voucher signer.",
    status: "NOT_INTEGRATED",
    codePath: "none",
    evidence: "none",
    notClaimed: "No Dynamic SDK is installed or called. Do not submit for the Dynamic bounty on the strength of this repository.",
  },
  {
    name: "Privy",
    role: "Planned: sponsor wallet provisioning beyond login.",
    status: "NOT_INTEGRATED",
    codePath: "none",
    evidence: "none",
    notClaimed: "No Privy SDK is installed or called.",
  },
  {
    name: "Envio HyperSync",
    role: "Reads every event the vault has emitted and rebuilds each agent's credit record for the recorded run page.",
    status: "REAL_ON_TESTNET",
    codePath: "app/api/activity/route.ts, components/activity-feed.tsx",
    evidence: "One HyperSync query to https://10143.hypersync.xyz returns all vault logs since the deployment block; the route decodes them and derives funded, repaid and revenue totals per agent. The feed on /proof is built from that response on every visit.",
    notClaimed: "HyperIndex is not used. The older viem and Postgres indexer in indexer/ is separate and has not been run against the live deployment.",
  },
  {
    name: "Chainlink CRE",
    role: "Could attest that an off chain job paid out before it counts as revenue.",
    status: "NOT_PLANNED",
    codePath: "none",
    evidence: "none",
    notClaimed: "Revenue today counts only from payers the sponsor allowlisted.",
  },
];
