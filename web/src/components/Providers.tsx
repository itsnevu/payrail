"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { injected, walletConnect } from "@wagmi/connectors";
import { useState } from "react";
import { CHAINS } from "@/lib/chains";

// WalletConnect lets a buyer on a phone pay from MetaMask/Rabby/etc. via QR or deep link.
// Optional: without a project id only the injected (extension) wallet is offered.
const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// Every enabled chain is registered so a buyer can switch to whichever network the invoice
// is on. Each transport points at that chain's browser RPC (the same-origin relay for
// Robinhood Chain, see lib/chains.ts).
const chains = CHAINS.map((c) => c.chain) as [typeof CHAINS[number]["chain"], ...typeof CHAINS[number]["chain"][]];

export const wagmiConfig = createConfig({
  chains,
  connectors: [
    injected(),
    ...(WC_PROJECT_ID
      ? [
          walletConnect({
            projectId: WC_PROJECT_ID,
            showQrModal: true,
            metadata: {
              name: "Payrail",
              description: "USDG invoices, matched onchain.",
              url: APP_URL,
              icons: [`${APP_URL}/icons/icon-512.png`],
            },
          }),
        ]
      : []),
  ],
  transports: Object.fromEntries(CHAINS.map((c) => [c.id, http(c.browserRpc)])),
  ssr: true,
});

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
