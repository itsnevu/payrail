"use client";

import { useSyncExternalStore } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { DEFAULT_CHAIN_ID, getChain } from "@/lib/chains";
import { shortAddr } from "@/lib/usdc";

export type ConnectButtonProps = {
  className?: string;
  label?: string;
  /** Network the caller needs the wallet on (an invoice's chain). Defaults to the app default. */
  chainId?: number;
};

/** Injected-wallet connect button. Shows a short address plus disconnect when connected. */
export default function ConnectButton({ className = "", label = "Connect wallet", chainId: wantId = DEFAULT_CHAIN_ID }: ConnectButtonProps) {
  const want = getChain(wantId) ?? getChain(DEFAULT_CHAIN_ID)!;
  // false during SSR/hydration, true once mounted in the browser (avoids wallet-state mismatches)
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const { address, isConnected, isConnecting, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const base = className || "btn-primary";

  if (!mounted) {
    return (
      <button type="button" className={base} disabled>
        {label}
      </button>
    );
  }

  if (isConnected && address) {
    if (chainId !== want.id) {
      return (
        <button type="button" className="btn-secondary" onClick={() => switchChain({ chainId: want.id })}>
          Switch to {want.name}
        </button>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="tnum rounded-full border border-line bg-surface px-3.5 py-2 font-mono text-[13.5px] font-medium text-ink">
          {shortAddr(address)}
        </span>
        <button
          type="button"
          onClick={() => disconnect()}
          className="rounded-full px-3 py-2 text-[13.5px] font-semibold text-ink-soft hover:bg-field"
          aria-label="Disconnect wallet"
        >
          Disconnect
        </button>
      </span>
    );
  }

  // Prefer the injected wallet when one exists; otherwise fall back to WalletConnect (phones).
  const injectedConnector = connectors.find((c) => c.type === "injected");
  const wcConnector = connectors.find((c) => c.type === "walletConnect");
  const hasInjected = typeof window !== "undefined" && Boolean((window as { ethereum?: unknown }).ethereum);
  const primary = hasInjected && injectedConnector ? injectedConnector : wcConnector ?? injectedConnector;
  const busy = isPending || isConnecting;

  if (!primary) {
    return (
      <button type="button" className={base} disabled title="No wallet found">
        No wallet
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <button type="button" className={base} disabled={busy} onClick={() => connect({ connector: primary })}>
        {busy ? "Connecting…" : primary.type === "walletConnect" ? "Connect wallet" : label}
      </button>
      {/* Extension present but the user is on WalletConnect-capable setup: offer both. */}
      {primary.type === "injected" && wcConnector && (
        <button
          type="button"
          className="rounded-full px-3 py-2 text-[13.5px] font-semibold text-ink-soft hover:bg-field"
          disabled={busy}
          onClick={() => connect({ connector: wcConnector })}
          title="Scan with a mobile wallet"
        >
          Mobile
        </button>
      )}
    </span>
  );
}
