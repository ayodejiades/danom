# Danom: agent credit on Monad

Credit for AI agents that can only spend where their sponsor allows.

A lender vault is the **payer** of x402 batch settlement payment channels. An AI agent holds only a **voucher signing key**, never the money. It repays from its own revenue, builds a credit record any vendor can read, and its sponsor can lock less collateral as that record grows.

![Danom landing page and credit flow](docs/demo.gif)

Built for [Monad Metropolis](https://monad.xyz/developers/hackathons/metropolis), primary track **Trust, Identity and AI Infrastructure**.

## How it works

1. **Lenders** supply stablecoin to one shared vault and earn the interest borrowers pay.
2. A **sponsor** (person or DAO) locks collateral and opens a credit line for one agent: a per channel cap, a credit ceiling, an expiry, an APR, a revenue repay share, and a list of vendors the agent may pay.
3. The **agent** asks the vault to fund a channel to an approved vendor. Every check runs before any token moves. The vault deposits into the canonical [x402 batch settlement](https://docs.x402.org/schemes/batch-settlement) contract, naming the agent as `payerAuthorizer`. The agent then signs cumulative vouchers off chain, and the vendor claims and settles in batches.
4. **Revenue repays first.** A customer the sponsor allowlisted pays the agent through the vault; a share goes to the loan before the agent sees the rest.
5. **The record.** Lifetime repaid principal is kept per agent, so it follows the agent to a new sponsor. It sets a tier (0 to 3), and the tier sets how much credit each unit of collateral supports (75%, 100%, 150%, 250%). A default pins the agent back to tier 0.

## What is real

| | Status |
|---|---|
| `CreditVault` contract | Written and tested. **Deployed to Monad testnet** at `0x959c59B1a46545e6AE2Fcba48A37bD93D93787dD` ([explorer](https://testnet.monadscan.com/address/0x959c59B1a46545e6AE2Fcba48A37bD93D93787dD)), wired to the canonical x402 contract and a `MockAUSD` token. **One full credit cycle of 19 transactions has run against it on testnet** (see below). `pnpm deploy:verify` re-checks it on chain. |
| x402 batch settlement | The **real canonical contract** at `0x4020074e9dF2ce1deE5A9C1b5c3f541D02a10003`, which has code on Monad testnet (10143) and mainnet (143). The vault was run against it on an Anvil fork and, in the live run, directly on Monad testnet. |
| Tests | 22 vault tests pass offline against a mock and against the real contract on a Monad testnet fork. 12 TypeScript tests pass. |
| Live run | `LIVE_RUN.json`: 19 transactions on Monad testnet, 4 of 4 refusals matched. Scripted, with test tokens. |
| Recorded run | `PROOF_RUNS.json`: 50 transactions on a local fork, 8 of 8 attempts outside the policy refused with the expected error. Covers tier graduation, the portable record and liquidation, which the live run does not. |
| Token | `MockAUSD`. Not real AUSD or USDC. |
| Facilitator | Monad runs a hosted x402 facilitator that lists batch settlement for Monad. **This project does not call it.** |
| Sponsor SDKs | **Dynamic, Privy and Envio are not integrated.** See `docs/SPONSOR_INTEGRATIONS.md`. |

The testnet activity is the two deployments and one scripted run. The longer recorded run happened on a local fork. See `CLAIM_LEDGER.md` for every claim with its evidence and limitation, and `docs/HONESTY.md` for the known risks.

## Live on Monad testnet

`tools/live-run.ts` drove the deployed vault through one full credit cycle on Monad testnet (2026-10-13). All 19 transactions are in `LIVE_RUN.json` and on the explorer.

| # | Step | Transaction |
|---|---|---|
| 1 | funder sends the agent gas | [`0x0a9894f3…`](https://testnet.monadscan.com/tx/0x0a9894f3d742dc35b8142aad7e7c3185863501b3169e7951758dc07339f3b904) |
| 2 | funder sends the vendor gas | [`0xc6664f50…`](https://testnet.monadscan.com/tx/0xc6664f50e103237a2d3396450e0bf53f90720fb45c0aeb9936976c85ab1bbd3d) |
| 3 | mint test stablecoin to the funder | [`0xa80d6195…`](https://testnet.monadscan.com/tx/0xa80d6195e8bc8e68f8d03a3a1b21603ca614bce3927b8d11e9a2d4b87bbde37a) |
| 4 | funder approves the vault | [`0xbb65fb6b…`](https://testnet.monadscan.com/tx/0xbb65fb6b444566dc397cab7e40b6c21507497418f78b89d875b542325757c2f3) |
| 5 | lender supplies 1000 to the vault | [`0x23a7eb3a…`](https://testnet.monadscan.com/tx/0x23a7eb3a32b04fc33e1fbce8d33fbce1e0a2ab17bbfef8c20103ae657f977af5) |
| 6 | sponsor opens a line for the agent: 400 collateral, 100 base, 40 per channel, 10% APR, 30 days, 50% revenue share | [`0xbdbb2e06…`](https://testnet.monadscan.com/tx/0xbdbb2e06fbe06ec497da2307ebcff4f0e73fb4573436c252d44eae00824467b8) |
| 7 | sponsor allowlists the vendor | [`0x23e2a4b4…`](https://testnet.monadscan.com/tx/0x23e2a4b4750711d02105dc8c51c9f1bfae677a23486e55f9c6a09f7609d2a326) |
| 8 | sponsor allowlists the customer as a revenue payer | [`0x35a9abb4…`](https://testnet.monadscan.com/tx/0x35a9abb4a3318cefbd5e3d81633ac74a7d693d2444c16d90c52a4435803ef97a) |
| 9 | agent asks the vault to fund a 40.00 channel for the vendor (quote 25) | [`0xf6868ade…`](https://testnet.monadscan.com/tx/0xf6868ade43e5f9800d46dd0fa1b607467d31fe29da0088e47f62bc1bee016b6e) |
| 10 | vendor claims the agent's signed voucher for 25.00 | [`0x6ced01d5…`](https://testnet.monadscan.com/tx/0x6ced01d5f3dcb76e0a5bb1fa11659bb5a7acd99ab76f2cb6cbc4e0400554868c) |
| 11 | anyone settles the claimed funds to the vendor | [`0xd3c1ddbf…`](https://testnet.monadscan.com/tx/0xd3c1ddbfe49e97027a287fe46bd38cc1c8ae8bb9085bd63e15460eacb2795718) |
| 12 | vendor refunds the 15 it did not use, straight to the vault | [`0x07664293…`](https://testnet.monadscan.com/tx/0x0766429373e87f6541f09884cd0bec1fc6fdcbe62cbe4af46c3cbc40b63e8259) |
| 13 | anyone reconciles: debt drops by 15 | [`0x54a884ac…`](https://testnet.monadscan.com/tx/0x54a884acd5435040558715cd4e7d34c5124d76eb31151907b3520a1c78121733) |
| 14 | sponsor repays the 25 owed | [`0xacaa440c…`](https://testnet.monadscan.com/tx/0xacaa440c708e1e6e6235b5950e1edf5b142fd586adfbd7a62e895aa642dc61ec) |
| 15 | agent asks the vault to fund a 40.00 channel for the vendor (quote 40) | [`0xff2ac73a…`](https://testnet.monadscan.com/tx/0xff2ac73a602a8f453f3b3f5dc57b74afff9630fa4b6a13ff17e03a32a241f3fd) |
| 16 | vendor claims the agent's signed voucher for 40.00 | [`0x180c904d…`](https://testnet.monadscan.com/tx/0x180c904d892c254693a10b1056c579d69ec4c5eb93c9c75f20d52bbd991e9943) |
| 17 | anyone settles the claimed funds to the vendor | [`0x5e7f99ea…`](https://testnet.monadscan.com/tx/0x5e7f99eaab4bfab549b483b2dfce395321e5ca17b24bdff9f1a256d1e7082a26) |
| 18 | a customer pays the agent 100 through the vault: the loan is repaid first | [`0xeefa6329…`](https://testnet.monadscan.com/tx/0xeefa63292027080c75bb67fe4e1542a1ded59547f032ff142bbed917b41c0657) |
| 19 | sponsor revokes the line | [`0x175ab0a3…`](https://testnet.monadscan.com/tx/0x175ab0a3057732a36a7075ed951262a4bc41cf6d24d57328eeaf593bc3723caf) |

What the run shows:

- The agent ended with **0.00** of the stablecoin. It signed vouchers and never held the money.
- The vault funded a 40.00 channel; the vendor claimed 25.00 and refunded 15.00, and reconcile dropped the debt to 25.00.
- A customer paid 100.00 through the vault. The 40.00 loan was repaid first and the agent received 60.00.
- 4 of 4 out of policy attempts were refused with the expected error. These were checked by simulation against the live vault, so they sent no transaction.

Limits of this run: it is scripted, one funded wallet played lender, sponsor, customer and keeper, the agent and vendor were throwaway keys, and the token is `MockAUSD`. Re-run it with `pnpm live:run` (needs a funded testnet key in `.env`) or rehearse it on a fork with `pnpm live:dry`.

## Known limits

- An agent and an approved vendor that **collude** can claim a channel's full escrow. The channel deposit, bounded by the per channel cap and the credit ceiling, is the most that can be lost.
- **Revoke** stops new funding at once, but escrow already in a channel comes back only after the channel's withdraw delay (at least 15 minutes) or a vendor refund.
- The record can be **farmed** by an agent that borrows and repays its own small lines. That costs it interest; it is not sybil proof. Tier thresholds are demo parameters, not calibrated risk numbers, and tiers above 100% are undercollateralized.
- Refunded tokens sit idle until someone calls `reconcile`. They are never counted in lender share price before then.
- The contracts are not audited.

## Run it

```bash
pnpm install
forge build
pnpm test                 # 12 TypeScript tests
forge test                # 39 offline Foundry tests
pnpm contracts:test:fork  # the vault suite against the real x402 contract (needs the Monad RPC)
pnpm proof:local          # re-record PROOF_RUNS.json on an Anvil fork of Monad testnet
pnpm live:dry             # rehearse the live testnet run on a fork
pnpm claim:verify         # re-derive every claim; exits non zero if one outruns its evidence
DEMO_MODE=1 pnpm dev      # the app, offline
```

## Layout

- `contracts/src/CreditVault.sol` the vault. `contracts/src/interfaces/IX402BatchSettlement.sol` the slice of the x402 contract it calls.
- `contracts/test/` Foundry tests, including `CreditVault.t.sol` (runs on a mock offline and the real contract on a fork).
- `lib/credit.ts` the TypeScript mirror of the vault's rules, used by the demo and pinned to the chain by tests.
- `tools/live-run.ts` the live testnet run. `tools/local-proof.ts` the recorded run. `tools/claim-verify.ts` the claim checker.
- `app/` the landing page, the interactive demo and the recorded run page.
- `indexer/` a viem based event indexer for the vault's events.
