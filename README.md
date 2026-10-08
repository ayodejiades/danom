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
| `CreditVault` contract | Written and tested. **Deployed to Monad testnet** at `0x959c59B1a46545e6AE2Fcba48A37bD93D93787dD` ([explorer](https://testnet.monadscan.com/address/0x959c59B1a46545e6AE2Fcba48A37bD93D93787dD)), wired to the canonical x402 contract and a `MockAUSD` token. Deployment only: **no lending, channel or repayment transaction has been sent to it yet.** `pnpm deploy:verify` re-checks it on chain. |
| x402 batch settlement | The **real canonical contract** at `0x4020074e9dF2ce1deE5A9C1b5c3f541D02a10003`, which has code on Monad testnet (10143) and mainnet (143). The vault was run against it on an Anvil fork. |
| Tests | 22 vault tests pass offline against a mock and against the real contract on a Monad testnet fork. 12 TypeScript tests pass. |
| Recorded run | `PROOF_RUNS.json`: 50 transactions on a local fork, 8 of 8 attempts outside the policy refused with the expected error. |
| Token | `MockAUSD`. Not real AUSD or USDC. |
| Facilitator | Monad runs a hosted x402 facilitator that lists batch settlement for Monad. **This project does not call it.** |
| Sponsor SDKs | **Dynamic, Privy and Envio are not integrated.** See `docs/SPONSOR_INTEGRATIONS.md`. |

Only the two deployment transactions exist on Monad testnet. Every recorded run happened on a local fork. See `CLAIM_LEDGER.md` for every claim with its evidence and limitation, and `docs/HONESTY.md` for the known risks.

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
pnpm claim:verify         # re-derive every claim; exits non zero if one outruns its evidence
DEMO_MODE=1 pnpm dev      # the app, offline
```

## Layout

- `contracts/src/CreditVault.sol` the vault. `contracts/src/interfaces/IX402BatchSettlement.sol` the slice of the x402 contract it calls.
- `contracts/test/` Foundry tests, including `CreditVault.t.sol` (runs on a mock offline and the real contract on a fork).
- `lib/credit.ts` the TypeScript mirror of the vault's rules, used by the demo and pinned to the chain by tests.
- `tools/local-proof.ts` the recorded run. `tools/claim-verify.ts` the claim checker.
- `app/` the landing page, the interactive demo and the recorded run page.
- `indexer/` a viem based event indexer for the vault's events.
