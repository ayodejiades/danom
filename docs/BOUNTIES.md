# Sponsor bounties

Primary track: **Trust, Identity and AI Infrastructure** ($30,000). Bounties named for a different track cannot be paired with it.

This table says what the repository does today, not what it hopes to do.

| Bounty | Prize | Track | Status | What would be needed |
|---|---|---|---|---|
| Best Use of Dynamic | $5,000 | All tracks | **Not integrated** | Install the Dynamic SDK and use its embedded or agent wallet for the sponsor or the agent voucher signer. Needs a Dynamic environment id from the sponsor's account. |
| Privy | $5,000 | All tracks | **Not integrated** | Use Privy beyond login, for example sponsor wallet provisioning. Needs a Privy app id. |
| Best Use of Envio | $1,000 | All tracks | **Integrated (HyperSync)** | Done: `app/api/activity/route.ts` reads every vault event through `https://10143.hypersync.xyz` in one query and rebuilds each agent's credit record; the feed is on the recorded run page. HyperIndex is not used. |
| Best workflow with CRE (Chainlink) | $3,000 | All tracks | Not planned | Could attest that an off chain job paid out before it counts as revenue. |
| Best use of Nansen | $5,000 pool | All tracks | Not planned | |
| Best Integration of Cleanverse Verified Identity | $2,000 | Trust, Identity and AI Infrastructure | Not planned | Would gate sponsor or agent onboarding behind Cleanverse identity. Same track as ours. |
| Best Builds with Qwen 3.8 Max | $5,000 credits | Trust, Identity and AI Infrastructure | **Entered, with a caveat** | The agent is driven by Qwen 3.8 27B (Groq), not Max, because we had no Max access. It plans, calls four real tools and answers; see `docs/QWEN.md`. A Qwen Cloud key in `QWEN_API_KEY` makes Max the primary model. |
| Best Community Team Project | $5,000 | All tracks | Unknown | Only for teams from Metropolis community supporters. |
| Agora, Kuru, Perpl, MetaMask | various | Other tracks | Not applicable | Tied to Consumer Payments or Onchain Finance tracks. |

The submission enters the Envio and Qwen bounties and the primary track.
