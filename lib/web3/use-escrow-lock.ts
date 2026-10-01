"use client";

import { useWalletStore } from "@/lib/web3/wallet-store";
import { buildLockPaymentTransaction, randomTradeId } from "@/lib/web3/escrow-program";
import { buyerFeeThb, thbToLamports } from "@/lib/pricing";

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

  /**
   * `feeTo` is the platform wallet: pass it to charge the buyer-protection fee
   * in the same transaction (Buy Now, accepted offers) — not for bids.
   */
  async function lock(priceThb: number, sellerWalletAddress: string | null, fallbackMessage: string, feeTo?: string | null) {
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
      fee: feeTo ? { platform: feeTo, lamports: thbToLamports(buyerFeeThb(priceThb)) } : undefined,
    });
    const txSignature = await signAndSendRawTransaction(transactionBytes);
    return { tradeId: tradeId.toString(), txSignature, lamports: lamports.toString(), tradeAccount } satisfies EscrowLock;
  }

  return { lock, connecting };
}
