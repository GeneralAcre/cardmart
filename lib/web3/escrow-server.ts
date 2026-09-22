import "server-only";
// Server-side signer for the escrow program's authority-only instructions
// (release/refund). This is deliberately NOT something warehouse staff sign
// with their own wallet — the platform itself is the trusted party that
// approves a release once inspection passes, same as today's
// requireAdmin()-gated Server Actions, just now backed by a real on-chain
// signature instead of a DB-only status flip.
//
// Keypair loading + sign-and-send lives in lib/web3/authority-server.ts,
// shared with lib/web3/token-server.ts (same platform authority mints and
// transfers digital-twin tokens too).
import { getEscrowAuthorityAddress, signAndSend } from "@/lib/web3/authority-server";
import {
  buildReleaseToSellerInstruction,
  buildRefundToBuyerInstruction,
} from "@/lib/web3/escrow-program";

export { getEscrowAuthorityAddress };

/** Real on-chain release: pays the trade's locked lamports to the seller and closes the account. Returns the tx signature. */
export async function releaseTradeToSeller(opts: {
  buyer: string;
  seller: string;
  tradeId: bigint;
}): Promise<string> {
  const authorityAddress = await getEscrowAuthorityAddress();
  if (!authorityAddress) throw new Error("Escrow authority is not configured.");

  const instruction = await buildReleaseToSellerInstruction({
    authority: authorityAddress,
    buyer: opts.buyer,
    seller: opts.seller,
    tradeId: opts.tradeId,
  });
  return signAndSend([instruction], authorityAddress);
}

/** Real on-chain refund: returns the trade's full locked balance to the buyer and closes the account. Returns the tx signature. */
export async function refundTradeToBuyer(opts: { buyer: string; tradeId: bigint }): Promise<string> {
  const authorityAddress = await getEscrowAuthorityAddress();
  if (!authorityAddress) throw new Error("Escrow authority is not configured.");

  const instruction = await buildRefundToBuyerInstruction({
    authority: authorityAddress,
    buyer: opts.buyer,
    tradeId: opts.tradeId,
  });
  return signAndSend([instruction], authorityAddress);
}
