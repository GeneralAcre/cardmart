import "server-only";
// Shared platform-authority signer, used by both the escrow program
// (lib/web3/escrow-server.ts) and the digital-twin token flows
// (lib/web3/token-server.ts) — one key, one keypair cache, one sign-and-send
// helper, so both real on-chain paths load ESCROW_AUTHORITY_SECRET_KEY the
// same way instead of each re-implementing it.
//
// ESCROW_AUTHORITY_SECRET_KEY holds the same 64-byte JSON array a
// `solana-keygen` keypair file contains — copy the file's contents straight
// into the env var. This key is NEVER the escrow program's upgrade authority
// (see contracts/escrow/README.md); losing it only risks day-to-day
// release/refund/mint/transfer flows, not the deployed program code.
import {
  address,
  appendTransactionMessageInstruction,
  appendTransactionMessageInstructions,
  compileTransaction,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransaction,
  type Instruction,
  type Signature,
} from "@solana/kit";
import { createKeyPairFromBytes } from "@solana/keys";
import { getAddressFromPublicKey } from "@solana/addresses";
import { createServerRpc } from "@/lib/web3/rpc-url";

export const rpc = createServerRpc();

let cachedKeyPair: Promise<CryptoKeyPair> | null = null;

function escrowAuthoritySecretBytes(): Uint8Array {
  const raw = process.env.ESCROW_AUTHORITY_SECRET_KEY;
  if (!raw) throw new Error("ESCROW_AUTHORITY_SECRET_KEY is not configured.");
  return Uint8Array.from(JSON.parse(raw) as number[]);
}

export function loadEscrowAuthorityKeyPair(): Promise<CryptoKeyPair> {
  if (!cachedKeyPair) {
    cachedKeyPair = createKeyPairFromBytes(escrowAuthoritySecretBytes());
  }
  return cachedKeyPair;
}

/** Public devnet address of the configured escrow/platform authority, or null if unconfigured. */
export async function getEscrowAuthorityAddress(): Promise<string | null> {
  if (!process.env.ESCROW_AUTHORITY_SECRET_KEY) return null;
  const { publicKey } = await createKeyPairFromBytes(escrowAuthoritySecretBytes(), true);
  return getAddressFromPublicKey(publicKey);
}

/**
 * Signs and sends one or more instructions as a single transaction, paid for
 * and signed by the platform authority. `extraSigners` is for instructions
 * that also need a fresh, one-time-use account keypair to sign (e.g.
 * creating a new SPL mint account) — the authority key always signs too.
 */
export async function signAndSend(
  instructions: Instruction[],
  feePayer: string,
  extraSigners: CryptoKeyPair[] = [],
): Promise<string> {
  const keyPair = await loadEscrowAuthorityKeyPair();
  const { value: latestBlockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();

  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(address(feePayer), m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
    (m) =>
      instructions.length === 1
        ? appendTransactionMessageInstruction(instructions[0], m)
        : appendTransactionMessageInstructions(instructions, m),
  );

  const compiled = compileTransaction(message);
  const signed = await signTransaction([keyPair, ...extraSigners], compiled);
  const wireTransaction = getBase64EncodedWireTransaction(signed);

  await rpc.sendTransaction(wireTransaction, { encoding: "base64", preflightCommitment: "confirmed" }).send();
  const signature = getSignatureFromTransaction(signed);
  await waitForConfirmation(signature, latestBlockhash.lastValidBlockHeight);
  return signature;
}

/**
 * Waits until a sent transaction is confirmed, so callers never record a
 * release, refund, mint or transfer that hasn't actually landed. Throws if it
 * failed on-chain, or if its blockhash expires first (it can then never land,
 * so it's safe to retry).
 */
async function waitForConfirmation(signature: Signature, lastValidBlockHeight: bigint): Promise<void> {
  for (let attempt = 0; attempt < 90; attempt++) {
    const { value } = await rpc.getSignatureStatuses([signature]).send();
    const status = value[0];
    if (status?.err) throw new Error(`Transaction ${signature} failed on-chain.`);
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return;
    if (attempt % 5 === 4) {
      const height = await rpc.getBlockHeight({ commitment: "confirmed" }).send();
      if (height > lastValidBlockHeight) throw new Error(`Transaction ${signature} expired before confirming. Try again.`);
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  throw new Error(`Transaction ${signature} is taking too long to confirm. Check it on Solana Explorer.`);
}
