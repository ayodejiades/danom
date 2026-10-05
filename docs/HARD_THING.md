# The one hard thing: an agent that spends without ever holding the money

## The problem

An agent that pays for APIs needs to spend. Every common answer gives it something dangerous: a wallet it can drain, an allowance it can use on anyone, or a session key with no ceiling. If its key leaks, the loss is whatever the wallet held.

## The mechanism

1. **The vault is the payer.** `CreditVault` is the `payer` of x402 batch settlement channels. The agent is named only as `payerAuthorizer`, the key that signs vouchers. It never receives tokens.
2. **The policy runs inside the deposit.** The x402 contract lets any caller name any deposit collector. `CreditVault` names itself. It sets a one time authorization for exactly `(channelId, amount)` in `fundChannel`, calls `settlement.deposit`, and its `collect` callback releases tokens only if that authorization is present. A stranger who calls `deposit` with the vault as collector is refused (`UnauthorizedCollect`, tested). So the vendor allowlist, the per channel cap, the credit ceiling and the expiry are checked in the same transaction that moves the money.
3. **Refunds cannot inflate the share price.** A vendor's refund reaches the vault with no callback. The vault prices lender shares from tokens it has booked itself (`accounted`), not from its raw balance. `reconcile` books the refund and lowers the agent's debt in one step. Without this, a lender could withdraw between a refund and its bookkeeping at an overstated price.
4. **A record that follows the agent.** Lifetime repaid principal is kept per agent. It sets a tier, and the tier sets how much credit a unit of collateral supports. A default pins the agent to tier 0.

## What the tests show

| Property | Where |
|---|---|
| The agent's token balance never changes while the vault pays a vendor | `CreditVault.t.sol` `test_funding_escrows_to_the_channel_and_the_agent_never_holds_tokens`; `PROOF_RUNS.json` run 1 |
| A deposit that names the vault as collector but was not authorized by the vault is refused | `test_direct_deposit_cannot_pull_from_the_vault` |
| A voucher signed by anyone but the agent is refused by the real x402 contract | `test_voucher_from_any_key_but_the_agent_is_refused`; recorded refusal |
| A refund does not change share value before `reconcile` | `test_a_refund_cannot_inflate_the_share_price_before_reconcile` |
| The vault never holds fewer tokens than it has booked (256 fuzz runs) | `testFuzz_the_vault_never_holds_less_than_it_has_booked` |

The 22 vault tests run offline against a mock settlement and against the real canonical contract on a Monad testnet fork. Removing the receiver allowlist check makes the suite fail, so the tests can catch that class of mistake.

## Where it stops

- An agent and an approved vendor that collude can claim a channel's full escrow. The channel deposit is the maximum loss, bounded by the per channel cap and the credit ceiling.
- Revoke stops new funding at once. Escrow already committed comes back after the channel's withdraw delay (at least 15 minutes) or a vendor refund.
- The record can be farmed at the cost of interest. Tier thresholds are demo parameters, and tiers above 100% are undercollateralized.
- The contracts are not audited. See `docs/HONESTY.md`.
