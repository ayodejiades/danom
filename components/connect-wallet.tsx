"use client";

import { useSyncExternalStore } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { monadTestnet } from "wagmi/chains";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-pill)] px-4 py-2 text-sm font-semibold transition-all duration-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60";
const solid = `${base} bg-[var(--navy)] text-white hover:bg-[var(--accent)] hover:text-[var(--accent-contrast)]`;
const outline = `${base} border border-[var(--navy)] bg-white text-[var(--fg)] hover:bg-[var(--navy)] hover:text-white`;
const warn = `${base} bg-[var(--sun)] text-[var(--accent-contrast)] hover:bg-[var(--navy)] hover:text-white`;

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function ConnectWallet() {
  // Wallet state only exists in the browser; render the disconnected button until mounted so the
  // server and first client render match.
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending, error, reset } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();

  if (mounted && isConnected && address) {
    if (chainId !== monadTestnet.id) {
      return (
        <button type="button" data-demo="switch-network" className={warn} disabled={switching} onClick={() => switchChain({ chainId: monadTestnet.id })}>
          {switching ? "Switching…" : "Switch to Monad testnet"}
        </button>
      );
    }
    return (
      <button type="button" data-demo="disconnect" className={outline} title="Disconnect wallet" onClick={() => disconnect()}>
        <span aria-hidden className="h-2 w-2 rounded-full bg-[var(--mint)]" />
        <span className="font-mono">{shortAddress(address)}</span>
      </button>
    );
  }

  const connector = connectors[0];
  return (
    <button
      type="button"
      data-demo="connect"
      className={error ? warn : solid}
      disabled={isPending || !connector}
      title={error ? "No wallet responded. Install or unlock a browser wallet, then try again." : undefined}
      onClick={() => {
        reset();
        if (connector) connect({ connector, chainId: monadTestnet.id });
      }}
    >
      {isPending ? "Connecting…" : error ? "No wallet found, retry" : "Connect wallet"}
    </button>
  );
}
