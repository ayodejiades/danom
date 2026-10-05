# Integrations and their real status

Generated from `lib/seams.ts`. A row that says NOT_INTEGRATED means the repository does not use that service at all.

| Service | Role | Status | Evidence | Not claimed |
| --- | --- | --- | --- | --- |
| x402 batch settlement (canonical contract on Monad) | Escrow, cumulative vouchers, claim, settle and refund for every payment the agent makes. | `REAL_ON_FORK` | Contract at 0x4020074e9dF2ce1deE5A9C1b5c3f541D02a10003 has code on Monad testnet (10143) and mainnet (143). Fork tests and tools/local-proof.ts run the vault against it on an Anvil fork. | The recorded runs happened on a local fork. Only the two deployment transactions were broadcast to Monad testnet. |
| Monad x402 facilitator | Hosted verify and settle service that would relay deposits, claims and refunds. | `NOT_INTEGRATED` | https://x402-facilitator.molandak.org/supported lists batch-settlement for eip155:10143 and eip155:143. | The proof run has the vendor claim directly as receiver authorizer. No request was sent to the facilitator. |
| Dynamic | Planned: embedded wallet for the sponsor and the agent voucher signer. | `NOT_INTEGRATED` | none | No Dynamic SDK is installed or called. Do not submit for the Dynamic bounty on the strength of this repository. |
| Privy | Planned: sponsor wallet provisioning beyond login. | `NOT_INTEGRATED` | none | No Privy SDK is installed or called. |
| Envio | Index credit vault events for the receipts view and the credit record. | `BUILT_UNTESTED_LIVE` | The indexer decodes every CreditVault event and DEMO_MODE serves the recorded events from fixtures/events.json. | The indexer reads through plain RPC, not HyperIndex or HyperSync, so it does not qualify for the Envio bounty as it stands. |
| Chainlink CRE | Could attest that an off chain job paid out before it counts as revenue. | `NOT_PLANNED` | none | Revenue today counts only from payers the sponsor allowlisted. |
