# Demo path

1. **An agent that can only spend where its sponsor allows** — go to `/`
2. **Open the credit flow** — click `[data-demo='launch-demo']`, wait for `[data-demo='list']`
3. **The agent asks the vault to pay its own wallet** — click `[data-demo='receiver-self']`
4. **The vault refuses** — click `[data-demo='trigger-escrow']`, wait for `[data-demo='row']`
5. **Now an approved vendor, above the cap** — click `[data-demo='receiver-vendor']`, fill `[data-demo='provider-input']` with "41"
6. **Refused again** — click `[data-demo='trigger-escrow']`
7. **Thirty is inside the cap** — fill `[data-demo='provider-input']` with "30"
8. **The vault funds the channel** — click `[data-demo='trigger-escrow']`
9. **A customer pays the agent** — click `[data-demo='route-revenue']`

Everything not listed above is stubbed, hardcoded, or deleted. That is the correct prioritisation under a deadline, not technical debt.

## Fallback
If the live deploy is unreachable, `docs/fallback.mp4` is a recording of the exact path above, captured in `DEMO_MODE`.
