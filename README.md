# [Danom](https://monad-metropolis-one.vercel.app)

Credit for AI agents that can only spend where their sponsor allows.

A lender vault is the payer of x402 batch settlement channels on Monad. The agent holds a voucher signing key and never the money. It repays from its own revenue, and each repayment adds to an on-chain record that lets its sponsor lock less collateral.

Built for [Monad Metropolis](https://monad.xyz/developers/hackathons/metropolis), primary track Trust, Identity and AI Infrastructure.

## Demo

**[monad-metropolis-one.vercel.app](https://monad-metropolis-one.vercel.app)**. No wallet or login needed.

![Danom landing page and credit flow](docs/demo.gif)

Three things to try:

1. Open **Live agent**. Press **Call the API**: the paid endpoint answers 402 with its price. Press **Sign and pay**: your browser signs a voucher with the demo agent's key and the same endpoint answers 200, paid from vault escrow on Monad testnet. Then press **Pay the agent itself** and watch the live vault refuse.
2. Open **Credit flow**. Ask for 41 to the approved vendor: refused, the cap is 40. Ask for 30: funded. Route a customer payment and watch the loan get repaid before the agent is paid.
3. Open **Recorded run**. The 19 testnet transactions link to the explorer, and a checkbox lets you tamper with the receipts to see every digest check fail.

## How it works

1. **Lenders** supply stablecoin to one shared vault and earn the interest borrowers pay.
2. A **sponsor** (a person or a DAO) locks collateral and opens a credit line for one agent: the vendors it may pay, a cap per channel, a credit ceiling, an expiry, an APR and a revenue share.
3. The **agent** asks the vault to fund a channel to an approved vendor. Every check runs before any token moves. The vault deposits into the canonical [x402 batch settlement](https://docs.x402.org/schemes/batch-settlement) contract and names the agent as `payerAuthorizer`. The agent signs cumulative vouchers off chain, and the vendor claims and settles in batches.
4. **Revenue repays first.** A customer the sponsor allowlisted pays the agent through the vault, and a share goes to the loan before the agent sees the rest.
5. **The record.** Lifetime repaid principal is kept per agent, so it follows the agent to a new sponsor. It sets a tier from 0 to 3, and the tier sets how much credit each unit of collateral supports: 75%, 100%, 150%, 250%. A default pins the agent back to tier 0.

The limits are contract reverts. A payment to the agent's own wallet reverts with `ReceiverNotAllowed`, one above the cap with `OverPerBorrowCap`, and one after the sponsor revokes with `LineInactive`.

## Why a sponsor would bother

What 100 of locked collateral backs, by the agent's record:

| Agent's record | Tier | May owe up to | Whose money is exposed |
|---|---|---|---|
| New agent | 0 | 75 | Nobody beyond the sponsor. The lender is over-covered. |
| 100 repaid | 1 | 100 | The sponsor's collateral covers all of it. |
| 500 repaid | 2 | 150 | 50 rides on the agent's record. Lenders carry it. |
| 2,000 repaid | 3 | 250 | 150 rides on the record. One default sends the agent back to tier 0. |

The limit is also earned: it starts at a base the sponsor sets and grows by each unit of principal repaid, up to the ceiling above. The demo line locks 400 against a starting limit of 100.

- **Why not hand the agent a spending cap?** A cap spends the sponsor's own money and has to be pre-funded. Here the sponsor's capital is a guarantee and lenders' capital does the spending. The agent's key holds nothing, and every repayment builds a record a cap never produces.
- **Is tier 0 really credit?** No. For a new agent this is a guarantee with a spending policy. Credit starts at tier 2, when the agent may owe more than its sponsor locked.
- **What is not solved?** Pricing that risk. The thresholds are demo parameters, and a record can be farmed at the cost of interest. Calibrating tiers needs real repayment data.

## A paid API call, end to end

The site hosts a paid API at `/api/vendor/gas`. This is the loop an agent runs against it:

1. The agent requests the data and gets **HTTP 402** with a price (0.25 per call) and where to escrow it.
2. If its channel to that vendor is empty, the agent asks the vault to fund it. The money is the vault's. The agent holds none.
3. The agent signs a cumulative voucher and retries with it in the payment header, as a batch-settlement `voucher` payload. The vendor has **Monad's hosted x402 facilitator** verify it (`x402-facilitator.molandak.org/verify`), checks on chain that the channel's escrow covers it, and answers **200** with the data.
4. The vendor claims the last voucher on chain and settles the funds to itself.

`tools/agent.ts` ran this on Monad testnet on 2026-10-13: 3 paid calls, the vendor received 0.75 on chain, and the agent's own balance stayed 0.00. The record is [`AGENT_RUN.json`](AGENT_RUN.json).

| # | Step | Transaction |
|---|---|---|
| 1 | Sponsor opens a line for the agent: 400 collateral, 100 limit, 40 per channel, 30 days | [`0xcc6cf5e6…`](https://testnet.monadscan.com/tx/0xcc6cf5e6002c066b7c0c379074350932bf895493671ddb2c7d0f0a7ecb9403cf) |
| 2 | Sponsor approves the vendor for this agent | [`0x4d007a33…`](https://testnet.monadscan.com/tx/0x4d007a33ac7c3b55fbc48d1c1b750700ee377524d96edd7a9c7c46f9fd350b30) |
| 3 | Sponsor sends the agent gas (MON only, no stablecoin) | [`0x8f715c3e…`](https://testnet.monadscan.com/tx/0x8f715c3e3d960ad65dbf8ac40072884a9f9c371aa9b8c7de2a01252a13715dc1) |
| 4 | Sponsor sends the vendor gas | [`0x699ef139…`](https://testnet.monadscan.com/tx/0x699ef13990f38006f8588754e495445d3eaf7a0c27d104bcfced81ef5b8695e5) |
| 5 | Agent asks the vault to fund a 10.00 channel to the vendor | [`0xfcef566a…`](https://testnet.monadscan.com/tx/0xfcef566a64a3e05b9eb701e7955b6d0d323be29dddb834490b830d3b4697ee0f) |
| 6 | Vendor claims the agent's voucher for 0.75 total | [`0x6f2c92eb…`](https://testnet.monadscan.com/tx/0x6f2c92eb6263476402de235c5e0451f27b1f7b61915298138f43cb431e8df9fc) |
| 7 | Vendor settles the claimed funds to itself | [`0x610d986b…`](https://testnet.monadscan.com/tx/0x610d986bc50448b597c558bbd1b5894ffc585bdea0fdc569a545c19d94f64a42) |

**The demo agent's private key is published** in [`lib/x402.ts`](lib/x402.ts) and on the Live agent page. That is the point: with the key in hand, asking the vault to pay any address the sponsor did not approve reverts with `ReceiverNotAllowed`. The most a thief can do is spend the credit line at the approved vendor and burn the agent's gas, until the sponsor revokes the line.

Limits: the facilitator verifies vouchers but does not settle; the vendor claims on chain itself. The vault funds the channel directly, not through the scheme's deposit payload. The demo vendor keeps no state between requests, so it does not track the highest voucher it has seen.

## Live on Monad testnet

| Contract | Address |
|---|---|
| `CreditVault` | [`0x959c59B1a46545e6AE2Fcba48A37bD93D93787dD`](https://testnet.monadscan.com/address/0x959c59B1a46545e6AE2Fcba48A37bD93D93787dD) |
| x402 batch settlement (canonical) | [`0x4020074e9dF2ce1deE5A9C1b5c3f541D02a10003`](https://testnet.monadscan.com/address/0x4020074e9dF2ce1deE5A9C1b5c3f541D02a10003) |
| `MockAUSD` (test token) | [`0xffAA4a80Ce47071CC880632be756EBA0cF363F27`](https://testnet.monadscan.com/address/0xffAA4a80Ce47071CC880632be756EBA0cF363F27) |

`tools/live-run.ts` drove the deployed vault through one full credit cycle on 2026-10-13. All 19 transactions are in [`LIVE_RUN.json`](LIVE_RUN.json).

| # | Step | Transaction |
|---|---|---|
| 1 | Funder sends the agent gas | [`0x0a9894f3…`](https://testnet.monadscan.com/tx/0x0a9894f3d742dc35b8142aad7e7c3185863501b3169e7951758dc07339f3b904) |
| 2 | Funder sends the vendor gas | [`0xc6664f50…`](https://testnet.monadscan.com/tx/0xc6664f50e103237a2d3396450e0bf53f90720fb45c0aeb9936976c85ab1bbd3d) |
| 3 | Mint test stablecoin to the funder | [`0xa80d6195…`](https://testnet.monadscan.com/tx/0xa80d6195e8bc8e68f8d03a3a1b21603ca614bce3927b8d11e9a2d4b87bbde37a) |
| 4 | Funder approves the vault | [`0xbb65fb6b…`](https://testnet.monadscan.com/tx/0xbb65fb6b444566dc397cab7e40b6c21507497418f78b89d875b542325757c2f3) |
| 5 | Lender supplies 1000 to the vault | [`0x23a7eb3a…`](https://testnet.monadscan.com/tx/0x23a7eb3a32b04fc33e1fbce8d33fbce1e0a2ab17bbfef8c20103ae657f977af5) |
| 6 | Sponsor opens a line for the agent: 400 collateral, 100 base, 40 per channel, 10% APR, 30 days, 50% revenue share | [`0xbdbb2e06…`](https://testnet.monadscan.com/tx/0xbdbb2e06fbe06ec497da2307ebcff4f0e73fb4573436c252d44eae00824467b8) |
| 7 | Sponsor allowlists the vendor | [`0x23e2a4b4…`](https://testnet.monadscan.com/tx/0x23e2a4b4750711d02105dc8c51c9f1bfae677a23486e55f9c6a09f7609d2a326) |
| 8 | Sponsor allowlists the customer as a revenue payer | [`0x35a9abb4…`](https://testnet.monadscan.com/tx/0x35a9abb4a3318cefbd5e3d81633ac74a7d693d2444c16d90c52a4435803ef97a) |
| 9 | Agent asks the vault to fund a 40.00 channel for the vendor (quote 25) | [`0xf6868ade…`](https://testnet.monadscan.com/tx/0xf6868ade43e5f9800d46dd0fa1b607467d31fe29da0088e47f62bc1bee016b6e) |
| 10 | Vendor claims the agent's signed voucher for 25.00 | [`0x6ced01d5…`](https://testnet.monadscan.com/tx/0x6ced01d5f3dcb76e0a5bb1fa11659bb5a7acd99ab76f2cb6cbc4e0400554868c) |
| 11 | Anyone settles the claimed funds to the vendor | [`0xd3c1ddbf…`](https://testnet.monadscan.com/tx/0xd3c1ddbfe49e97027a287fe46bd38cc1c8ae8bb9085bd63e15460eacb2795718) |
| 12 | Vendor refunds the 15 it did not use, straight to the vault | [`0x07664293…`](https://testnet.monadscan.com/tx/0x0766429373e87f6541f09884cd0bec1fc6fdcbe62cbe4af46c3cbc40b63e8259) |
| 13 | Anyone reconciles: debt drops by 15 | [`0x54a884ac…`](https://testnet.monadscan.com/tx/0x54a884acd5435040558715cd4e7d34c5124d76eb31151907b3520a1c78121733) |
| 14 | Sponsor repays the 25 owed | [`0xacaa440c…`](https://testnet.monadscan.com/tx/0xacaa440c708e1e6e6235b5950e1edf5b142fd586adfbd7a62e895aa642dc61ec) |
| 15 | Agent asks the vault to fund a 40.00 channel for the vendor (quote 40) | [`0xff2ac73a…`](https://testnet.monadscan.com/tx/0xff2ac73a602a8f453f3b3f5dc57b74afff9630fa4b6a13ff17e03a32a241f3fd) |
| 16 | Vendor claims the agent's signed voucher for 40.00 | [`0x180c904d…`](https://testnet.monadscan.com/tx/0x180c904d892c254693a10b1056c579d69ec4c5eb93c9c75f20d52bbd991e9943) |
| 17 | Anyone settles the claimed funds to the vendor | [`0x5e7f99ea…`](https://testnet.monadscan.com/tx/0x5e7f99eaab4bfab549b483b2dfce395321e5ca17b24bdff9f1a256d1e7082a26) |
| 18 | A customer pays the agent 100 through the vault: the loan is repaid first | [`0xeefa6329…`](https://testnet.monadscan.com/tx/0xeefa63292027080c75bb67fe4e1542a1ded59547f032ff142bbed917b41c0657) |
| 19 | Sponsor revokes the line | [`0x175ab0a3…`](https://testnet.monadscan.com/tx/0x175ab0a3057732a36a7075ed951262a4bc41cf6d24d57328eeaf593bc3723caf) |

What the run shows:

- The agent ended with 0.00 of the stablecoin. It signed vouchers and never held the money.
- The vault funded a 40.00 channel. The vendor claimed 25.00 and refunded 15.00, and reconcile dropped the debt to 25.00.
- A customer paid 100.00 through the vault. The 40.00 loan was repaid first and the agent received 60.00.
- 4 of 4 attempts outside the policy were refused with the expected error. These were simulated against the live vault, so they sent no transaction.

The run is scripted. One funded wallet played lender, sponsor, customer and keeper, and the agent and vendor were throwaway keys.

## What is real

| | Status |
|---|---|
| `CreditVault` | Deployed on Monad testnet and exercised by the live run above. `pnpm deploy:verify` re-checks it on chain. |
| x402 batch settlement | The canonical contract, which has code on Monad testnet (10143) and mainnet (143). The vault calls it directly on testnet and on a fork. |
| Paid API loop | `AGENT_RUN.json`: 3 paid HTTP calls, 7 transactions on Monad testnet, vendor paid 0.75 from vault escrow. |
| Live run | `LIVE_RUN.json`: 19 transactions on Monad testnet, 4 of 4 refusals matched. |
| Recorded run | `PROOF_RUNS.json`: 50 transactions on a local fork of Monad testnet, 8 of 8 refusals matched. It covers tier graduation, the portable record and liquidation, which the live run does not. |
| Tests | 22 Foundry tests pass offline against a mock, and the same suite passes against the real x402 contract on a fork. 12 TypeScript tests pass. |
| Token | `MockAUSD`, a test token with open minting. Not AUSD or USDC. |
| x402 facilitator | Monad's hosted facilitator verifies every voucher the vendor accepts. It does not settle for this vendor. |
| Dynamic, Privy, Envio | Not integrated. See [`docs/SPONSOR_INTEGRATIONS.md`](docs/SPONSOR_INTEGRATIONS.md). |

[`CLAIM_LEDGER.md`](CLAIM_LEDGER.md) pairs every claim with its evidence and its limitation. `pnpm claim:verify` regenerates it and exits non zero if a claim outruns its evidence.

## Known limits

- An agent and an approved vendor that collude can claim a channel's full escrow. The channel deposit, bounded by the per channel cap and the credit ceiling, is the most that can be lost.
- Revoking stops new funding at once, but escrow already in a channel comes back only after the channel's withdraw delay (at least 15 minutes) or a vendor refund.
- The record can be farmed by an agent that borrows and repays its own small lines. That costs it interest. It is not sybil proof.
- Tier thresholds are demo parameters, not calibrated risk numbers, and tiers above 100% are undercollateralized.
- Refunded tokens sit idle until someone calls `reconcile`. They are never counted in lender share price before then.
- The contracts are not audited. See [`SECURITY.md`](SECURITY.md) and [`docs/HONESTY.md`](docs/HONESTY.md).

## Run it

Needs Node 20 or later, pnpm and [Foundry](https://getfoundry.sh).

```bash
pnpm install
DEMO_MODE=1 pnpm dev
```

Open `http://localhost:3000`. Then check the claims yourself:

```bash
pnpm test                 # 12 TypeScript tests
forge test                # 22 Foundry tests, offline
pnpm contracts:test:fork  # the same suite against the real x402 contract on a fork
pnpm claim:verify         # re-derive every claim and re-check the deployment on chain
pnpm agent:dry            # rehearse the paid HTTP loop on a local fork
pnpm live:dry             # rehearse the full credit cycle on a local fork
pnpm proof:local          # re-record PROOF_RUNS.json on a fork
```

`pnpm live:run` broadcasts the cycle to Monad testnet. It needs `PRIVATE_KEY` for a wallet with about 4 testnet MON in a gitignored `.env`.

## Where things are

- `contracts/src/CreditVault.sol`: the vault. `contracts/src/interfaces/IX402BatchSettlement.sol`: the part of the x402 contract it calls.
- `lib/x402.ts`: the paid endpoint's protocol, shared by the vendor route, the agent CLI and the browser.
- `lib/credit.ts`: a TypeScript mirror of the vault's rules, used by the site and pinned to the contract by tests.
- `tools/`: the agent that pays over HTTP 402, the live run, the recorded run, the claim checker and the deployment check.
- `app/`: the landing page, the live agent page, the credit flow, the recorded run page and the vendor API.
- `indexer/`: a viem event indexer for the vault's events.

## License

MIT
