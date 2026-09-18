// Builds a real, unsigned Solana transaction containing a single Memo
// instruction — used to make minting/listing a genuinely on-chain event
// instead of a simulated signature. No custom program is deployed (that's
// the real Phase 2 work), so the Memo program is the honest middle ground:
// a real, permanent, publicly verifiable devnet transaction recording what
// happened, signed by the seller's own wallet — not a bespoke digital-twin
// program, but not fake either.
import {
  address,
  appendTransactionMessageInstruction,
  compileTransaction,
  createSolanaRpc,
  createTransactionMessage,
  getTransactionEncoder,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
} from "@solana/kit";
import { getAddMemoInstruction } from "@solana-program/memo";

// Same devnet cluster as everywhere else (components/providers/privy-provider.tsx, lib/solana.ts).
const rpc = createSolanaRpc("https://api.devnet.solana.com");

export async function buildMemoTransaction(fromAddress: string, memo: string): Promise<Uint8Array> {
  const { value: latestBlockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();

  // No explicit signer list needed on the instruction itself — the fee
  // payer already has to sign the transaction as a whole (Privy does that
  // part), which satisfies the memo program's signer requirement.
  const instruction = getAddMemoInstruction({ memo });

  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(address(fromAddress), m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
    (m) => appendTransactionMessageInstruction(instruction, m),
  );

  return new Uint8Array(getTransactionEncoder().encode(compileTransaction(message)));
}
