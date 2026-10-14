# Submission text

Copy for the Monad Metropolis submission form. Every figure here comes from `LIVE_RUN.json`, `PROOF_RUNS.json` or the test suites.

## Primary track

Trust, Identity and AI Infrastructure

## Project name

Danom

## One-line description

Credit for AI agents that can only spend where their sponsor allows: the vault pays, the agent only signs.

## Description

**The problem.** An AI agent has to pay for APIs, data and compute. Today that means giving it a funded wallet or an open allowance, so one leaked key or one bad prompt can drain everything. Nobody will lend to an agent on those terms.

**What Danom does.** Danom is a credit layer for x402 agents on Monad. A lender vault is the payer of x402 batch settlement channels, so the agent never holds the money. It holds a voucher signing key and nothing else.

- Lenders supply stablecoin to one shared vault and earn the interest borrowers pay.
- A sponsor (a person or a DAO) locks collateral and opens a credit line for one agent: the vendors it may pay, a cap per channel, a credit ceiling, an expiry, an APR and a revenue share.
- The agent asks the vault to fund a channel to an approved vendor. Every check runs in the contract before a token moves. The agent then signs cumulative vouchers off chain and the vendor claims and settles in batches.
- Revenue repays first. Customers pay the agent through the vault, and the loan is settled before the agent receives the rest.
- Lifetime repaid principal is kept per agent, not per sponsor. That record follows the agent to a new sponsor and raises its tier, so the same collateral supports more credit. A default pins the agent back to tier 0.

**A real paid call, end to end.** The site hosts a paid API at `/api/vendor/gas`. Unpaid, it answers HTTP 402 with a price. An agent retries with a signed voucher in the payment header. The vendor has Monad's hosted x402 facilitator verify it, checks the escrow on chain, and only then serves the data. The money comes from escrow the vault funded on the agent's behalf, and the vendor claims and settles it on chain. On the Live agent page a judge can do this in the browser, because the demo agent's private key is published there on purpose. With that key in hand, asking the live vault to pay any other address reverts with `ReceiverNotAllowed`.

**A model in the loop.** The same tools are handed to a language model. On the Live agent page a Qwen 3.8 model runs on demand: it states a plan, reads the price from the 402, checks its credit, buys a report through the vault and answers with the figures. Told to pay 50 to a stranger, it obeyed and asked the vault, and the vault refused. The policy lives in the contract, so it holds whatever the model decides.

**What is real.** `CreditVault` is deployed on Monad testnet at `0x959c59B1a46545e6AE2Fcba48A37bD93D93787dD` and runs against the canonical x402 batch settlement contract at `0x4020074e9dF2ce1deE5A9C1b5c3f541D02a10003`. One full credit cycle of 19 transactions ran on testnet: fund a 40.00 channel, claim a signed voucher, settle, refund, reconcile, repay, route revenue, revoke. The agent ended with 0.00 of the stablecoin. A 100.00 customer payment repaid the 40.00 loan first and the agent received 60.00. Four of four attempts outside the policy were refused with the expected error. Every transaction is linked from the site's recorded run page and listed in `LIVE_RUN.json`.

A longer recorded run of 50 transactions on a fork of Monad testnet covers tier graduation (the same collateral supported 100.00 of credit, then 245.00 after three repaid rounds), the portable record and liquidation, with 8 of 8 refusals matched. 22 vault tests pass offline and against the real x402 contract on a fork.

**What makes it useful.** The limits are enforced by the contract, not by a policy document. A payment to the agent's own wallet reverts with `ReceiverNotAllowed`, one above the cap with `OverPerBorrowCap`, one after revoke with `LineInactive`. The site lets a judge try this without a wallet: the credit flow page runs the same rules in the browser.

**Honest limits.** This is a testnet preview. The token is a test token, the contracts are not audited, the agent's model runs on a rate-limited free tier (the page falls back to recorded runs when it is exhausted), and the facilitator verifies vouchers but does not settle. The demo vendor keeps no state between requests. An agent and an approved vendor that collude can claim a channel's full escrow, so the channel deposit is the most that can be lost. Tier thresholds are demo parameters, not calibrated risk numbers. The repository's `CLAIM_LEDGER.md` pairs every claim with its evidence and its limitation, and `pnpm claim:verify` fails if a claim outruns its evidence.

## Go-to-market and user acquisition

**First users: teams already running x402 agents on Monad.** They feel the problem today: they pre-fund agent wallets and absorb the risk themselves. Danom lets them act as their own agent's sponsor, with a cap per channel and a vendor allowlist, before any outside lender is involved. That first step needs no marketplace and no second side.

**How we reach them.**
1. Direct outreach to the agent builders in this hackathon and in the Monad and x402 developer channels, with a one-command path: point the agent's payer at the vault and keep the existing voucher flow.
2. Vendors as a channel. An API or data vendor that accepts x402 can accept a Danom-funded channel with no code change, because the vault uses the canonical settlement contract. Each vendor that says so brings its agent customers.
3. The x402 facilitator. Monad hosts a facilitator that lists batch settlement. Integrating with it, which is not done yet, would put Danom in the path agents already use.

**Second side: lenders and sponsors.** Once repayment records exist on chain, they are the pitch to lenders: a readable history per agent, loans that are repaid from revenue before the agent is paid, and a sponsor's collateral in front of the lender. DAOs and agent launchpads are the natural sponsors, since they already fund agents and want a ceiling on what one can spend.

**Sequence.** Self-sponsored lines on testnet with a handful of teams, then an audit and a real stablecoin, then open lending once there are enough repayment records to price tiers from data instead of the demo thresholds used today.

## GitHub repository

https://github.com/ayodejiades/danom

## Live product

https://danom-new.vercel.app

## Judge access instructions

No login or wallet is needed.

1. Open "Live agent". Press "Run the agent" to have a Qwen 3.8 model do a task live; pick the third task to tell it to pay a stranger and watch the vault refuse. Then press "Call the API": the paid endpoint answers 402 with its price. Press "Sign and pay": your browser signs a voucher with the demo agent's key and the same endpoint answers 200 with data, verified by Monad's x402 facilitator and paid from vault escrow on Monad testnet.
2. Still on "Live agent", press "Pay the agent itself" and "41 to the vendor". The live vault answers `ReceiverNotAllowed` and `OverPerBorrowCap`. These are simulations against the deployed contract, so nothing is sent.
3. Open "Recorded run" for the testnet transactions with explorer links, and "Credit flow" for an in-browser simulation of tiers, repayment and revocation.

To re-check from the repository: `pnpm install`, then `pnpm claim:verify`, `pnpm test` and `forge test`. `pnpm agent:dry` rehearses the paid HTTP loop on a local fork, and `pnpm live:dry` rehearses the full credit cycle.
