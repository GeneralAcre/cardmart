"use client";

import { useWalletStore } from "@/lib/web3/wallet-store";
import { buildLockPaymentTransaction, randomTradeId } from "@/lib/web3/escrow-program";
import { thbToLamports } from "@/lib/pricing";

export type EscrowLock = { tradeId: string; txSignature: string; lamports: string; tradeAccount: string };

/**
 * Wallet steps shared by both sides of a card swap: approving the platform to
 * move your card if the swap completes, and locking any cash you add in the
 * escrow program. Same fallbacks as the rest of the app — a card without a
 * real mint, or a counterparty without a real wallet, falls back to a
 * simulated step instead of blocking the trade.
 */
export function useTradeSigning() {
  const { connected, connect, publicKey, approveDelegate, signAndSendRawTransaction, signMessage } = useWalletStore();

  async function ensureConnected() {
    if (!connected) await connect();
  }

  /** Returns the approve signature, or undefined if there's no real mint or signing isn't possible. */
  async function approveCard(mintAddress: string | null, escrowAuthorityAddress: string | null) {
    if (!mintAddress || !escrowAuthorityAddress) return undefined;
    try {
      return await approveDelegate(mintAddress, escrowAuthorityAddress);
    } catch {
      return undefined;
    }
  }

  /** Locks `amountThb` for `payeeWallet`. Throws if a real lock was possible but failed, so no cash is ever skipped silently. */
  async function lockCash(amountThb: number, payeeWallet: string | null): Promise<EscrowLock | undefined> {
    if (payeeWallet && publicKey) {
      const tradeId = randomTradeId();
      const lamports = thbToLamports(amountThb);
      const { transactionBytes, tradeAccount } = await buildLockPaymentTransaction({
        buyer: publicKey,
        seller: payeeWallet,
        tradeId,
        lamports,
      });
      const txSignature = await signAndSendRawTransaction(transactionBytes);
      return { tradeId: tradeId.toString(), txSignature, lamports: lamports.toString(), tradeAccount };
    }
    await signMessage(`Confirm ${amountThb} THB cash for this card swap`);
    return undefined;
  }

  return { ensureConnected, approveCard, lockCash };
}
