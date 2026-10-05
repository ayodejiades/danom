# Honesty notes

What a reader should know before relying on anything here.

## What ran, and where

- Every recorded run ran on a **local Anvil fork of Monad testnet**. State changes stayed in the fork.
- Exactly two transactions were broadcast to **Monad testnet**: deploying `MockAUSD` and deploying `CreditVault` (see `.kit/deployment.json`). Nothing has been sent to the deployed vault. Nothing was broadcast to mainnet.
- The **x402 batch settlement** contract in those runs is the real canonical contract, forked from Monad. Its voucher signature checks are the real ones.
- The **token** is `MockAUSD`, a test token with open minting. It is not AUSD or USDC.
- **No facilitator** was involved. The vendor claimed directly as its own receiver authorizer.

## Risks in the design

| Risk | Detail |
|---|---|
| Colluding agent and vendor | The agent can sign a voucher up to a channel's whole escrow, and an approved vendor can claim it. The most that can be lost this way is one channel deposit. Per channel cap and credit ceiling bound it. |
| Revoke is not a clawback | Revoke blocks new funding. Committed escrow returns after the channel's withdraw delay (at least 15 minutes) or a cooperative vendor refund. A voucher signed before revoke is still claimable against that escrow. |
| Record farming | An agent can borrow and repay its own lines to raise its tier. It pays interest to do so, and revenue only counts from payers the sponsor allowlisted. There is no sybil resistance beyond that cost. |
| Undercollateralized tiers | Tiers 2 and 3 support credit above the collateral. A default there is a loss to lenders. Thresholds are demo parameters, not calibrated risk numbers. |
| Unreconciled refunds | Tokens refunded by a vendor arrive with no callback. The vault does not count them in share price until `reconcile` is called, so they cannot be double counted, but they sit idle until then. |
| Overpaying escrowed debt | Principal that is still committed to a channel counts as debt. If an agent repays it and the escrow later returns, the vault ends up holding both. That favors lenders, but it is an odd outcome for the payer. |
| No oracle, no audit | Collateral, debt and payments are the same stablecoin. The contracts have not been audited. |

## What was checked

- 22 vault tests pass against a mock settlement offline and against the real contract on a Monad fork. Removing the receiver allowlist check makes the suite fail, so the tests can catch that class of bug.
- `pnpm claim:verify` re-derives every claim in `CLAIM_LEDGER.md` from `PROOF_RUNS.json` and exits non zero if one outruns its evidence.

## What was not checked

- Behavior with real AUSD or USDC, including whether the token supports EIP-3009 (the vault deposits through its own collector, so it does not need to).
- Any interaction with the Monad x402 facilitator.
- Gas costs on Monad, or throughput.
