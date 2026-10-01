import "server-only";
// Server-side proof that a buyer really locked the money they say they did.
// A browser reports its lock as { tradeId, txSignature, lamports,
// tradeAccount }; none of that can be trusted on its own — a tampered client
// could lock 1 lamport and claim the full price, or replay one lock for two
// purchases. So before any sale, bid or trade is recorded, this reads the
// Trade account straight from the chain and checks it against what the sale
// needs.
import { address, getAddressDecoder } from "@solana/kit";

import { prisma } from "@/lib/prisma";
import { rpc } from "@/lib/web3/authority-server";
import { ESCROW_PROGRAM_ID, deriveTradePda } from "@/lib/web3/escrow-program";

export interface EscrowLockClaim {
  tradeId: string;
  txSignature: string;
  lamports: string;
  tradeAccount: string;
}

// Trade account layout (contracts/escrow/programs/escrow/src/state.rs): an
// 8-byte Anchor discriminator, then buyer, seller, amount, trade_id, status.
const OFFSET = { buyer: 8, seller: 40, amount: 72, tradeId: 80, status: 88 } as const;
const STATUS_LOCKED = 0;
const addressDecoder = getAddressDecoder();

async function readTradeAccount(tradeAccount: string) {
  // The client sends its lock right after confirming it, but the RPC node
  // answering us may lag a moment behind — retry briefly before giving up.
  for (let attempt = 0; attempt < 5; attempt++) {
    const { value } = await rpc.getAccountInfo(address(tradeAccount), { encoding: "base64", commitment: "confirmed" }).send();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 1200));
  }
  return null;
}

/**
 * Throws a buyer-readable error unless `lock` is a real, still-locked escrow
 * trade by `buyer`, paying `seller` (when given), holding at least
 * `minLamports`, and not already used for anything else on CardMart.
 */
export async function verifyEscrowLock(
  lock: EscrowLockClaim,
  expected: { buyer: string; seller?: string | null; minLamports: bigint },
): Promise<void> {
  let tradeId: bigint;
  try {
    tradeId = BigInt(lock.tradeId);
  } catch {
    throw new Error("The payment lock is invalid. Try again.");
  }
  const pda = await deriveTradePda(address(expected.buyer), tradeId);
  if (pda !== lock.tradeAccount) throw new Error("The payment lock doesn't belong to your wallet.");

  const account = await readTradeAccount(lock.tradeAccount);
  if (!account) throw new Error("Your payment lock isn't on-chain yet. Wait a few seconds and try again.");
  if (account.owner !== ESCROW_PROGRAM_ID) throw new Error("The payment lock isn't held by CardMart's escrow.");

  const data = Buffer.from(account.data[0], "base64");
  if (data.length < OFFSET.status + 1) throw new Error("The payment lock is invalid. Try again.");
  const lockedBuyer = addressDecoder.decode(data.subarray(OFFSET.buyer, OFFSET.buyer + 32));
  const lockedSeller = addressDecoder.decode(data.subarray(OFFSET.seller, OFFSET.seller + 32));
  const amount = data.readBigUInt64LE(OFFSET.amount);
  const lockedTradeId = data.readBigUInt64LE(OFFSET.tradeId);
  const status = data[OFFSET.status];

  if (lockedBuyer !== expected.buyer || lockedTradeId !== tradeId) {
    throw new Error("The payment lock doesn't belong to your wallet.");
  }
  if (expected.seller && lockedSeller !== expected.seller) {
    throw new Error("The payment lock pays a different seller.");
  }
  if (status !== STATUS_LOCKED) throw new Error("That payment lock was already released or refunded.");
  if (amount < expected.minLamports) throw new Error("Less was locked than the price. Try again.");

  // One lock, one purchase: the same still-locked trade can't back two sales.
  const [sale, bid, trade] = await Promise.all([
    prisma.escrowTransaction.count({ where: { tradeAccount: lock.tradeAccount } }),
    prisma.bid.count({ where: { tradeAccount: lock.tradeAccount } }),
    prisma.tradeOffer.count({ where: { cashTradeAccount: lock.tradeAccount } }),
  ]);
  if (sale + bid + trade > 0) throw new Error("That payment lock was already used.");
}
