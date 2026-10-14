# Evidence for judges

Each row points at something in the repository you can run or read. Nothing here relies on the demo video.

| Criterion | Evidence | How to check |
|---|---|---|
| Problem fit | Agents need to pay, and a wallet or open allowance risks everything. The vault pays instead and the agent only signs. | `README.md`, `docs/HARD_THING.md` |
| Technical execution | 22 vault tests, offline and against the real x402 contract on a Monad fork; 12 TypeScript tests; a recorded run of 50 transactions on a fork with 8 of 8 refusals matched. | `forge test`, `pnpm contracts:test:fork`, `pnpm test`, `PROOF_RUNS.json`, page `/proof` |
| Live on Monad | `CreditVault` and `MockAUSD` are deployed on Monad testnet and the vault is wired to the canonical x402 contract. One scripted credit cycle of 19 transactions ran against it on testnet: fund a channel, claim a signed voucher, settle, refund, reconcile, repay, route revenue, revoke. | `pnpm deploy:verify`, `.kit/deployment.json`, `LIVE_RUN.json`, page `/proof` |
| Every claim is checked | `pnpm claim:verify` re-derives each claim from the recorded run and the tests, checks the deployment on chain, and exits non zero if a claim outruns its evidence. | `pnpm claim:verify`, `CLAIM_LEDGER.md` |
| A real paid call | The site hosts a paid API. An agent gets HTTP 402, pays with a signed voucher that Monad's hosted x402 facilitator verifies, and the vendor claims from vault escrow on testnet. A language model can drive the same tools. | `AGENT_RUN.json`, `AGENT_LLM_RUN.json`, page `/agent`, `pnpm agent:dry` |
| Sponsor integration | Envio HyperSync powers the vault event feed and the per-agent record on the recorded run page. Dynamic and Privy are not integrated; the repository says so. | `app/api/activity/route.ts`, `docs/SPONSOR_INTEGRATIONS.md`, `docs/BOUNTIES.md` |
| Design and usability | A landing page, a live agent page that makes real paid calls and simulates theft against the deployed vault, an interactive demo whose refusals come from the same rule functions the tests check, and a recorded run page with in browser receipt verification. No accessibility audit has been run. | `app/`, `/demo`, `/proof` |
| Honesty | What ran where, the design's risks, and what was not checked. | `docs/HONESTY.md`, `WHAT_IS_REAL.md` |

## Not claimed

The long recorded run happened on a local fork, not on Monad. The token is a test token. The Monad x402 facilitator verifies vouchers but does not settle for this vendor. The agent's model runs on a rate-limited free tier. The contracts are not audited.
