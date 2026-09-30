// lib/seams.ts — every outside dependency, with the status it really has today. claim:verify writes this
// table into docs/SPONSOR_INTEGRATIONS.md, so the docs cannot say more than this file does.
export type SeamStatus = "REAL_ON_FORK" | "BUILT_UNTESTED_LIVE" | "NOT_INTEGRATED" | "NOT_PLANNED";

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
    status: "REAL_ON_FORK",
    codePath: "contracts/src/CreditVault.sol, contracts/src/interfaces/IX402BatchSettlement.sol",
    evidence: "Contract at 0x4020074e9dF2ce1deE5A9C1b5c3f541D02a10003 has code on Monad testnet (10143) and mainnet (143). Fork tests and tools/local-proof.ts run the vault against it on an Anvil fork.",
    notClaimed: "No transaction was broadcast to Monad. Everything ran on a local fork.",
  },
  {
    name: "Monad x402 facilitator",
    role: "Hosted verify and settle service that would relay deposits, claims and refunds.",
    status: "NOT_INTEGRATED",
    codePath: "none",
    evidence: "https://x402-facilitator.molandak.org/supported lists batch-settlement for eip155:10143 and eip155:143.",
    notClaimed: "The proof run has the vendor claim directly as receiver authorizer. No request was sent to the facilitator.",
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
    name: "Envio",
    role: "Index credit vault events for the receipts view and the credit record.",
    status: "BUILT_UNTESTED_LIVE",
    codePath: "indexer/ (viem getLogs catchup and daemon, Postgres via drizzle)",
    evidence: "The indexer decodes every CreditVault event and DEMO_MODE serves the recorded events from fixtures/events.json.",
    notClaimed: "The indexer reads through plain RPC, not HyperIndex or HyperSync, so it does not qualify for the Envio bounty as it stands.",
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
