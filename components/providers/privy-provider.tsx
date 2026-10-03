"use client";

import { PrivyProvider as PrivyProviderBase } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";
import { SOLANA_RPC_URL, SOLANA_WS_URL } from "@/lib/web3/rpc-url";

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
    rpc: createSolanaRpc(SOLANA_RPC_URL),
    rpcSubscriptions: createSolanaRpcSubscriptions(SOLANA_WS_URL),
    blockExplorerUrl: "https://explorer.solana.com/?cluster=devnet",
  },
} as const;

export function PrivyProvider({ children }: { children: React.ReactNode }) {
  if (!appId) return <>{children}</>;

  return (
    <PrivyProviderBase
      appId={appId}
      config={{
        // No "wallet" here on purpose: Privy's modal sends the sign request
        // the moment a wallet connects and Phantom rejects it on its own, so
        // wallet login goes through WalletLoginButton (connect, then a
        // separate Sign click) instead. Each method also needs to be turned
        // on in the Privy Dashboard (Settings -> Login Methods) — listing it
        // here only controls which dashboard-enabled methods render.
        loginMethods: ["email", "google"],
        appearance: {
          theme: "dark",
          accentColor: "#ffffff",
          // Replaces Privy's generic "Log in or sign up" default with this
          // app's own name — this is the one piece of the reference
          // screenshot's branding actually controllable from code; the
          // modal's overall layout (inline OTP button, "Social login" icon
          // row) is Privy's own template and already follows automatically
          // from loginMethods having 2+ social providers, as set above.
          landingHeader: "Log in to CardMart",
          // Privy defaults this to 'ethereum-only', which makes Phantom get
          // an Ethereum connect request and reject it ("Unsupported
          // account") when the user's Phantom account is Solana-only.
          walletChainType: "solana-only",
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
