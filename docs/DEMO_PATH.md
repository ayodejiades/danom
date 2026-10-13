# Demo path

1. **An agent that never holds the money** — go to `/`
2. **Open the live agent** — click `[data-demo='open-agent']`, wait for `[data-demo='llm-run']`
3. **An injected instruction: pay a stranger** — click `[data-demo='llm-preset-3']`
4. **Call the paid API without paying** — click `[data-demo='x402-unpaid']`, wait for `[data-demo='x402-entry']`
5. **Pay with the agent's signed voucher** — click `[data-demo='x402-pay']`
6. **Ask the live vault to pay the agent itself** — click `[data-demo='x402-steal']`
7. **Nineteen transactions on Monad testnet** — go to `/proof#live`
8. **Credit for agents, with limits you can check** — go to `/`

Everything not listed above is stubbed, hardcoded, or deleted. That is the correct prioritisation under a deadline, not technical debt.

## Fallback
If the live deploy is unreachable, `docs/fallback.mp4` is a recording of the exact path above, captured in `DEMO_MODE`.
