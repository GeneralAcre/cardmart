"use client";

import { PrivyProvider as PrivyProviderBase } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";

// Only mount the real Privy provider when it's actually configured — in
// demo mode (no NEXT_PUBLIC_PRIVY_APP_ID) the app keeps working as the
// seeded "you" user, matching lib/session.ts's own fallback.
const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

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
          theme: "light",
          accentColor: "#18181b",
        },
        embeddedWallets: {
          solana: { createOnLogin: "users-without-wallets" },
        },
        externalWallets: {
          solana: { connectors: toSolanaWalletConnectors() },
        },
      }}
    >
      {children}
    </PrivyProviderBase>
  );
}
