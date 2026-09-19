import "server-only";
// Server-side signer for the escrow program's authority-only instructions
// (release/refund). This is deliberately NOT something warehouse staff sign
// with their own wallet — the platform itself is the trusted party that
// approves a release once inspection passes, same as today's
// requireAdmin()-gated Server Actions, just now backed by a real on-chain
// signature instead of a DB-only status flip.
//
// ESCROW_AUTHORITY_SECRET_KEY holds the same 64-byte JSON array a
// `solana-keygen` keypair file contains — copy the file's contents
// straight into the env var. This key is NEVER the program's upgrade
// authority (see contracts/escrow/README.md); losing it only risks this
// one program's day-to-day release/refund flow, not the deployed code.
import {
  address,
  appendTransactionMessageInstruction,
  compileTransaction,
  createSolanaRpc,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransaction,
  type Instruction,
} from "@solana/kit";
import { createKeyPairFromBytes } from "@solana/keys";
import { getAddressFromPublicKey } from "@solana/addresses";

import {
  buildReleaseToSellerInstruction,
  buildRefundToBuyerInstruction,
} from "@/lib/web3/escrow-program";

const rpc = createSolanaRpc("https://api.devnet.solana.com");

let cachedKeyPair: Promise<CryptoKeyPair> | null = null;

function escrowAuthoritySecretBytes(): Uint8Array {
  const raw = process.env.ESCROW_AUTHORITY_SECRET_KEY;
  if (!raw) throw new Error("ESCROW_AUTHORITY_SECRET_KEY is not configured.");
  return Uint8Array.from(JSON.parse(raw) as number[]);
}

function loadEscrowAuthorityKeyPair(): Promise<CryptoKeyPair> {
  if (!cachedKeyPair) {
    cachedKeyPair = createKeyPairFromBytes(escrowAuthoritySecretBytes());
  }
  return cachedKeyPair;
}

/** Public devnet address of the configured escrow authority, or null if unconfigured. */
export async function getEscrowAuthorityAddress(): Promise<string | null> {
  if (!process.env.ESCROW_AUTHORITY_SECRET_KEY) return null;
  const { publicKey } = await createKeyPairFromBytes(escrowAuthoritySecretBytes(), true);
  return getAddressFromPublicKey(publicKey);
}

async function signAndSend(instruction: Instruction, feePayer: string): Promise<string> {
  const keyPair = await loadEscrowAuthorityKeyPair();
  const { value: latestBlockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();

  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(address(feePayer), m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
    (m) => appendTransactionMessageInstruction(instruction, m),
  );

  const compiled = compileTransaction(message);
  const signed = await signTransaction([keyPair], compiled);
  const wireTransaction = getBase64EncodedWireTransaction(signed);

  await rpc.sendTransaction(wireTransaction, { encoding: "base64", preflightCommitment: "confirmed" }).send();
  return getSignatureFromTransaction(signed);
}

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
  return signAndSend(instruction, authorityAddress);
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
  return signAndSend(instruction, authorityAddress);
}
