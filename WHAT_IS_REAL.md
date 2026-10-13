# What is real

| Layer | Status |
| --- | --- |
| `CreditVault` (pool, lines, tiers, record, revenue router, liquidation) | Written and tested offline and on a Monad fork. Deployed to Monad testnet, where one scripted credit cycle has run against it (LIVE_RUN.json). |
| x402 batch settlement contract | The real canonical contract, at the same address on Monad testnet and mainnet. Used on a fork and in the live testnet run. |
| Vouchers | Real EIP-712 signatures checked by the real contract. |
| Token | MockAUSD. |
| Monad x402 facilitator | Exists and lists batch-settlement for Monad. Not called. |
| Sponsor SDKs (Dynamic, Privy) | Not integrated. |
| Indexer | Built on plain RPC. Not run against a live deployment. |
