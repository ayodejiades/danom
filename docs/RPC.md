# RPC and network setup

The project targets **Monad testnet** (chain id `10143`). Values below come from docs.monad.xyz.

| | |
|---|---|
| Public RPC | `https://testnet-rpc.monad.xyz` (QuickNode, 50 requests per second, 25 for `eth_call` and `eth_estimateGas`) |
| Other RPCs | `https://rpc-testnet.monadinfra.com` (Monad Foundation, 20 rps), `https://rpc.ankr.com/monad_testnet` |
| Explorer | https://testnet.monadscan.com (the address pages resolve; MonadVision returned 403 to a script) |
| Faucet | https://faucet.monad.xyz |
| Mainnet | chain id `143`, `https://rpc.monad.xyz` |

The public RPC limits `eth_getLogs` to a 100 block range. `tools/local-proof.ts` queries from the fork's first block for that reason, and the indexer reads in bounded chunks.

## Environment

Copy `.env.example` to `.env`. Never commit it, and never put a private key in a file inside the repo.

```bash
RPC_URL=https://testnet-rpc.monad.xyz
CHAIN_ID=10143
CONTRACT_ADDRESS=0x959c59B1a46545e6AE2Fcba48A37bD93D93787dD   # the deployed CreditVault
START_BLOCK=66922076                                          # its deployment block
```

## Deploy

```bash
export PRIVATE_KEY=0x...   # a funded throwaway key, exported for this shell only
forge script contracts/script/Deploy.s.sol --fork-url https://testnet-rpc.monad.xyz          # dry run
forge script contracts/script/Deploy.s.sol --rpc-url https://testnet-rpc.monad.xyz --broadcast
unset PRIVATE_KEY
```

Set `TOKEN=0x...` to lend a real stablecoin instead of deploying `MockAUSD`. Then run `pnpm deploy:verify` to check the result on chain.

## Recording the fork run

`pnpm proof:local` forks Monad testnet with Anvil and needs network access to the RPC above. Set `MONAD_RPC` to use a different endpoint.
