# Security

## Status

Danom is a hackathon testnet preview. The contracts are **not audited** and the token is a test token (`MockAUSD`). Do not use this code with real funds.

## What is deployed

| | Address | Network |
|---|---|---|
| `CreditVault` | `0x959c59B1a46545e6AE2Fcba48A37bD93D93787dD` | Monad testnet (10143) |
| `MockAUSD` | `0xffAA4a80Ce47071CC880632be756EBA0cF363F27` | Monad testnet (10143) |
| x402 batch settlement (canonical, not ours) | `0x4020074e9dF2ce1deE5A9C1b5c3f541D02a10003` | Monad testnet (10143) |

## Known limits

These are design limits, not undisclosed bugs. `docs/HONESTY.md` and `CLAIM_LEDGER.md` cover them in full.

- An agent and an approved vendor that collude can claim a channel's full escrow. The channel deposit, bounded by the per channel cap and the credit ceiling, is the most that can be lost.
- Revoking a line stops new funding at once, but escrow already in a channel returns only after the channel's withdraw delay or a vendor refund.
- The credit record can be farmed by an agent that borrows and repays its own small lines, at the cost of interest. It is not sybil proof.
- Tiers above 100% are undercollateralized. Tier thresholds are demo parameters, not calibrated risk numbers.

## Reporting a vulnerability

Please report privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability**. If that option is not available, open an issue that says only that you have a security report, without the details, and you will be contacted.

Include the contract or file, the steps to reproduce, and what an attacker gains. Reports that go beyond the known limits above are the most useful.

## Keys

No private key belongs in this repository. `.env` is gitignored, and scripts that broadcast read `PRIVATE_KEY` from the environment only.
