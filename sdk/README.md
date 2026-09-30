# @ayodejiades/sdk

> Programmatic TypeScript SDK for protocol execution, agent escrow, and verification.
> Engineered by **Ayodeji Adesegun** ([@ayodejiades](https://github.com/ayodejiades)).

## Installation

```bash
npm install @ayodejiades/sdk viem
# or
pnpm add @ayodejiades/sdk viem
```

## Quick Start

### 1. Agent Escrow & SLA Micropayments

```typescript
import { AgentEscrowClient } from "@ayodejiades/sdk";
import { baseSepolia } from "viem/chains";

const client = new AgentEscrowClient({
  contractAddress: "0x1234567890123456789012345678901234567890",
  chain: baseSepolia
});

// Query channel status
const channel = await client.getChannel(0n);
console.log("Channel status:", channel.status);
```

### 2. Intent Solver Cycle Settlement

```typescript
import { IntentSolverClient } from "@ayodejiades/sdk";

const solver = new IntentSolverClient({
  contractAddress: "0x1234567890123456789012345678901234567890"
});

const isExecuted = await solver.isIntentExecuted("0xabc...");
```

## License

MIT © Ayodeji Adesegun (@ayodejiades)
