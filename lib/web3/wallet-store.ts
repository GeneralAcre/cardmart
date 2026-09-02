"use client";

import { create } from "zustand";
import { mockPublicKey, mockTxSignature } from "@/lib/web3/mock-chain";

// Phase 2 seam: swap this store's internals for
// @solana/wallet-adapter-react's useWallet(). Keep the field names
// (connected, publicKey, connect, disconnect, signMessage) so every
// component that reads this store keeps working unchanged.
interface WalletState {
  connected: boolean;
  connecting: boolean;
  publicKey: string | null;
  connect: () => Promise<string>;
  disconnect: () => void;
  signMessage: (message: string) => Promise<string>;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  connected: false,
  connecting: false,
  publicKey: null,
  connect: async () => {
    set({ connecting: true });
    await new Promise((r) => setTimeout(r, 500));
    const publicKey = mockPublicKey();
    set({ connected: true, connecting: false, publicKey });
    return publicKey;
  },
  disconnect: () => {
    set({ connected: false, publicKey: null });
  },
  signMessage: async (message: string) => {
    void message; // Phase 2: this becomes the actual payload the wallet signs.
    if (!get().connected) throw new Error("Wallet not connected");
    await new Promise((r) => setTimeout(r, 300));
    return mockTxSignature();
  },
}));
