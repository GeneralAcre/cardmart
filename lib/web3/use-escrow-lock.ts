"use client";

import { useWalletStore } from "@/lib/web3/wallet-store";
import { buildLockPaymentTransaction, randomTradeId } from "@/lib/web3/escrow-program";
import { thbToLamports } from "@/lib/pricing";

export type EscrowLock = { tradeId: string; txSignature: string; lamports: string; tradeAccount: string };

/**
 * The buyer-signed lock_payment step shared by every flow that commits money
 * to a seller: buying a listing, completing an accepted offer, and placing
 * an auction bid. Locks `priceThb` (as lamports) in the escrow program when
 * both wallets exist; otherwise falls back to the simulated flow — a signed
 * confirmation message and no lock — same as the rest of the app.
 */
export function useEscrowLock() {
  const { connected, connecting, connect, publicKey, signMessage, signAndSendRawTransaction } = useWalletStore();

  async function lock(priceThb: number, sellerWalletAddress: string | null, fallbackMessage: string) {
    const buyer = connected && publicKey ? publicKey : await connect();
    if (!sellerWalletAddress || !buyer) {
      await signMessage(fallbackMessage);
      return undefined;
    }
    const tradeId = randomTradeId();
    const lamports = thbToLamports(priceThb);
    const { transactionBytes, tradeAccount } = await buildLockPaymentTransaction({
      buyer,
      seller: sellerWalletAddress,
      tradeId,
      lamports,
    });
    const txSignature = await signAndSendRawTransaction(transactionBytes);
    return { tradeId: tradeId.toString(), txSignature, lamports: lamports.toString(), tradeAccount } satisfies EscrowLock;
  }

  return { lock, connecting };
}
