"use client";

import { useCallback, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useCreateWallet, useSignMessage, useWallets } from "@privy-io/react-auth/solana";

// Phase 2 seam, now live: this used to be a zustand store standing in for
// @solana/wallet-adapter-react's useWallet(). It's now backed by a real
// Privy Solana embedded wallet — same field names (connected, publicKey,
// connect, disconnect, signMessage) as before, so every component that
// reads this hook keeps working unchanged.
//
// PRIVY_CONFIGURED is a build-time constant (Next.js inlines
// NEXT_PUBLIC_* vars at build time), so it never actually changes across
// renders for a given deploy — branching hook calls on it is safe, unlike
// branching on a normal runtime value.
const PRIVY_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);

export interface WalletStore {
  connected: boolean;
  connecting: boolean;
  publicKey: string | null;
  connect: () => Promise<string>;
  disconnect: () => void;
  signMessage: (message: string) => Promise<string>;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function usePrivyWalletStore(): WalletStore {
  const { authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const { createWallet } = useCreateWallet();
  const { signMessage: privySignMessage } = useSignMessage();
  const [connecting, setConnecting] = useState(false);

  const wallet = wallets[0] ?? null;
  const publicKey = wallet?.address ?? null;
  const connected = authenticated && Boolean(publicKey);

  const connect = useCallback(async (): Promise<string> => {
    setConnecting(true);
    try {
      if (wallet) return wallet.address;
      if (!authenticated) {
        login();
        throw new Error("Complete sign-in in the popup, then try again.");
      }
      // Should rarely hit this — embeddedWallets.solana.createOnLogin
      // already creates one automatically the moment someone signs in.
      const { wallet: created } = await createWallet();
      return created.address;
    } finally {
      setConnecting(false);
    }
  }, [wallet, authenticated, login, createWallet]);

  const disconnect = useCallback(() => {
    void logout();
  }, [logout]);

  const signMessage = useCallback(
    async (message: string): Promise<string> => {
      if (!wallet) throw new Error("Wallet not connected");
      const { signature } = await privySignMessage({
        message: new TextEncoder().encode(message),
        wallet,
      });
      return toHex(signature);
    },
    [wallet, privySignMessage],
  );

  return { connected, connecting, publicKey, connect, disconnect, signMessage };
}

/** Used when NEXT_PUBLIC_PRIVY_APP_ID isn't set — no PrivyProvider is
 * mounted in that case, so calling Privy's hooks would crash. */
function useUnconfiguredWalletStore(): WalletStore {
  return {
    connected: false,
    connecting: false,
    publicKey: null,
    connect: async () => {
      throw new Error("Wallet sign-in isn't configured yet.");
    },
    disconnect: () => {},
    signMessage: async () => {
      throw new Error("Wallet sign-in isn't configured yet.");
    },
  };
}

export function useWalletStore(): WalletStore {
  // eslint-disable-next-line react-hooks/rules-of-hooks -- PRIVY_CONFIGURED is a build-time constant, so this branch never changes across renders.
  return PRIVY_CONFIGURED ? usePrivyWalletStore() : useUnconfiguredWalletStore();
}
