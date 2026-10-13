# Integrations and their real status

Generated from `lib/seams.ts`. A row that says NOT_INTEGRATED means the repository does not use that service at all.

| Service | Role | Status | Evidence | Not claimed |
| --- | --- | --- | --- | --- |
| x402 batch settlement (canonical contract on Monad) | Escrow, cumulative vouchers, claim, settle and refund for every payment the agent makes. | `REAL_ON_TESTNET` | Contract at 0x4020074e9dF2ce1deE5A9C1b5c3f541D02a10003 has code on Monad testnet (10143) and mainnet (143). Fork tests and tools/local-proof.ts run the vault against it on an Anvil fork, and tools/live-run.ts ran one full cycle against it on Monad testnet (LIVE_RUN.json). | The testnet run is one scripted cycle with test tokens. The longer recorded run, with tier graduation and liquidation, happened on a local fork. |
| Monad x402 facilitator | Hosted verify and settle service that would relay deposits, claims and refunds. | `REAL_ON_TESTNET` | The vendor route posts every voucher to https://x402-facilitator.molandak.org/verify and serves only when it answers isValid. A forged voucher is rejected with invalid_batch_settlement_evm_voucher_signature. See lib/x402.ts. | Verification only. The facilitator does not settle or claim for this vendor, and the vault funds channels directly, not through a deposit payload. |
| Dynamic | Planned: embedded wallet for the sponsor and the agent voucher signer. | `NOT_INTEGRATED` | none | No Dynamic SDK is installed or called. Do not submit for the Dynamic bounty on the strength of this repository. |
| Privy | Planned: sponsor wallet provisioning beyond login. | `NOT_INTEGRATED` | none | No Privy SDK is installed or called. |
| Envio | Index credit vault events for the receipts view and the credit record. | `BUILT_UNTESTED_LIVE` | The indexer decodes every CreditVault event and DEMO_MODE serves the recorded events from fixtures/events.json. | The indexer reads through plain RPC, not HyperIndex or HyperSync, so it does not qualify for the Envio bounty as it stands. |
| Chainlink CRE | Could attest that an off chain job paid out before it counts as revenue. | `NOT_PLANNED` | none | Revenue today counts only from payers the sponsor allowlisted. |
