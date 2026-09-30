"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Button } from "@/components/ui/button";

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <Button data-demo="disconnect" onClick={() => disconnect()}>
        {shortAddress(address)} · Disconnect
      </Button>
    );
  }

  const connector = connectors[0];
  return (
    <Button
      data-demo="connect"
      disabled={isPending || !connector}
      onClick={() => connector && connect({ connector })}
    >
      {isPending ? "Connecting…" : "Connect wallet"}
    </Button>
  );
}
