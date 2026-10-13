"use client";

import { useSyncExternalStore } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { monadTestnet } from "wagmi/chains";

const solid = "btn btn-sm btn-primary";
const outline = "btn btn-sm";
const warn = "btn btn-sm btn-warn";

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
        <span aria-hidden className="h-2 w-2 rounded-full bg-[var(--ok)]" />
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
