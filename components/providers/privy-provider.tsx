"use client";

import { PrivyProvider as PrivyProviderBase } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";

// Only mount the real Privy provider when it's actually configured — in
// demo mode (no NEXT_PUBLIC_PRIVY_APP_ID) the app keeps working as the
// seeded "you" user, matching lib/session.ts's own fallback.
const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

// Devnet, not mainnet — this is a thesis demo, testnet SOL only. A Solana
// address itself isn't network-specific (same address works on every
// cluster), but any balance/transaction check needs to query the same
// cluster the funds were actually sent on, or it'll look empty.
const solanaDevnetRpc = {
  "solana:devnet": {
    rpc: createSolanaRpc("https://api.devnet.solana.com"),
    rpcSubscriptions: createSolanaRpcSubscriptions("wss://api.devnet.solana.com"),
    blockExplorerUrl: "https://explorer.solana.com/?cluster=devnet",
  },
} as const;

export function PrivyProvider({ children }: { children: React.ReactNode }) {
  if (!appId) return <>{children}</>;

  return (
    <PrivyProviderBase
      appId={appId}
      config={{
        // "wallet" lets someone log in with an existing Solana wallet
        // (Phantom, Backpack, etc.) instead of Google/email.
        loginMethods: ["google", "email", "wallet"],
        appearance: {
          theme: "dark",
          accentColor: "#ffffff",
        },
        embeddedWallets: {
          solana: { createOnLogin: "users-without-wallets" },
        },
        externalWallets: {
          solana: { connectors: toSolanaWalletConnectors() },
        },
        solana: { rpcs: solanaDevnetRpc },
      }}
    >
      {children}
    </PrivyProviderBase>
  );
}
