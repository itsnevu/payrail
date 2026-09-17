"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { injected, walletConnect } from "@wagmi/connectors";
import { useState } from "react";
import { chain, RPC_URL } from "@/lib/chain";

// WalletConnect lets a buyer on a phone pay from MetaMask/Rabby/etc. via QR or deep link.
// Optional: without a project id only the injected (extension) wallet is offered.
const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const wagmiConfig = createConfig({
  chains: [chain],
  connectors: [
    injected(),
    ...(WC_PROJECT_ID
      ? [
          walletConnect({
            projectId: WC_PROJECT_ID,
            showQrModal: true,
            metadata: {
              name: "Payrail",
              description: "USDC invoices, matched onchain.",
              url: APP_URL,
              icons: [`${APP_URL}/icons/icon-512.png`],
            },
          }),
        ]
      : []),
  ],
  transports: { [chain.id]: http(RPC_URL) },
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
