// lib/wagmi.ts — wallet config for Monad. Runs in the browser, so it must never import lib/env.ts.
// next.config.ts mirrors DEMO_MODE and the RPC URLs into NEXT_PUBLIC_ names read here.
import { createConfig, http } from "wagmi";
import { monad, monadTestnet } from "wagmi/chains";
import { injected, mock } from "wagmi/connectors";

const DEMO_ACCOUNT = "0x000000000000000000000000000000000000dEaD" as const;
const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

export const chains = [monadTestnet, monad] as const;

export const wagmiConfig = createConfig({
  chains,
  connectors: isDemoMode ? [mock({ accounts: [DEMO_ACCOUNT], features: { defaultConnected: false } })] : [injected()],
  transports: {
    [monadTestnet.id]: http(process.env.NEXT_PUBLIC_RPC_URL || undefined),
    [monad.id]: http(process.env.NEXT_PUBLIC_MONAD_RPC || undefined),
  },
  ssr: true,
});
