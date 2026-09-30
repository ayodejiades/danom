# SEAM_REPORT.md

Pre-broadcast verification of chain RPC, contract deployment, and gas assumptions.
Regenerate anytime with `pnpm seam:check`.

- Generated: 2026-09-30T04:04:21.055Z
- RPC: `https://sepolia.base.org`
- Target Chain: 84532
- Overall: **PARTIAL (some checks skipped)**

| Check | Result | Detail |
| --- | --- | --- |
| rpc reachable | PASS | https://sepolia.base.org |
| chain id | PASS | got 84532, expected 84532 |
| latest block readable | PASS | #47486386 |
| gas price readable | PASS | 0.0060 gwei |
| settlement contract deployed | NOT_DEPLOYED | 0x68516F5E3778a46755734A1c360b13410972b93C has no code on chain 84532 |
| explorer api surface | PASS | https://sepolia.basescan.org/api available for receipt verification |

## Adversarial Defense & Negative Invariant Proof

- **Synthetic Negative Probe**: Rejected (`BLOCK`)
- **Negative Invariant**: Kernel/solver strictly rejects tampered, forged, or unbound inputs (verdict !== "ALLOW")
- **Defense Mechanism**: Policy engine rejected forged spend intent
- **Proof Status**: PASS (Deterministic fail-closed rejection verified)
