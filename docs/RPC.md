# RPC.md — Web3 hour-one checklist & deployment workflow

## 1. Network configuration & RPC keys
- **Primary default:** **Base Sepolia** (Chain ID: `84532`, RPC: `https://sepolia.base.org`).
  Base is where top hackathon bounty pools live (Coinbase DevRel, onchain AI agents, consumer crypto).
- **Secondary networks:** Arbitrum Sepolia (`421614`, `https://sepolia-rollup.arbitrum.io/rpc`), Ethereum Sepolia (`11155111`).
- Copy your RPC key (Alchemy / Infura / QuickNode) into `.env`:
  ```bash
  BASE_SEPOLIA_RPC=https://base-sepolia.g.alchemy.com/v2/<KEY>
  RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<KEY>
  ```

## 2. Get testnet faucet funds
- **Base Sepolia:** https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet or https://faucets.chain.link/base-sepolia
- **Arbitrum Sepolia:** https://faucets.chain.link/arbitrum-sepolia
- **Sepolia:** https://sepoliafaucet.com

## 3. 1-Click Smart Contract Deployment & Verification
Never submit un-deployed contracts. Use Foundry to deploy directly to Base Sepolia:
```bash
# 1. Run local test suite and invariant fuzzing
pnpm contracts:test
pnpm contracts:gas

# 2. Deploy contracts to Base Sepolia and broadcast on-chain
pnpm contracts:deploy:base
```
Copy the printed `AgentEscrow` (or your primary contract) address into `.env`:
```bash
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
```
This automatically embeds your live Basescan link into the app's footer and into `SUBMISSION.md`.

## 4. Wallet Connectivity: Passkeys & Account Abstraction
- The frontend configures **Coinbase Smart Wallet (Passkeys / ERC-4337)** by default.
- Users connect via biometric passkeys (FaceID / TouchID) directly inside the browser DOM. No extension popups to hijack Playwright demo recording or judge evaluation.
- `DEMO_MODE=1` activates the deterministic offline mock connector with zero network overhead.

## 5. Indexing & Event Verification
- Confirm `getLogs` works against your deployed contract:
  ```bash
  pnpm indexer:catchup
  ```
- Swap `indexer/abi.ts` for your bounty's custom events and update `START_BLOCK` in `.env`.
