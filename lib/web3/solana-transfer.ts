// Builds a real, unsigned SOL transfer transaction — used by the withdraw
// flow in lib/web3/wallet-store.ts, which hands the resulting bytes to
// Privy's signAndSendTransaction to actually sign and broadcast it. Runs
// client-side and fetches the blockhash right before signing (not
// server-rendered) since a stale blockhash makes a transaction unlandable.
import {
  address,
  appendTransactionMessageInstruction,
  compileTransaction,
  createNoopSigner,
  createSolanaRpc,
  createTransactionMessage,
  getTransactionEncoder,
  lamports,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";

const LAMPORTS_PER_SOL = 1_000_000_000;

// Same devnet cluster as everywhere else (components/providers/privy-provider.tsx, lib/solana.ts).
const rpc = createSolanaRpc("https://api.devnet.solana.com");

export async function buildSolTransferTransaction(
  fromAddress: string,
  toAddress: string,
  amountSol: number,
): Promise<Uint8Array> {
  const { value: latestBlockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();

  // createNoopSigner: Privy does the actual signing via its embedded
  // wallet, not @solana/kit's own signer abstraction — this just marks the
  // source account as a required signer in the compiled instruction so the
  // transaction shape is correct.
  const instruction = getTransferSolInstruction({
    source: createNoopSigner(address(fromAddress)),
    destination: address(toAddress),
    amount: lamports(BigInt(Math.round(amountSol * LAMPORTS_PER_SOL))),
  });

  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(address(fromAddress), m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
    (m) => appendTransactionMessageInstruction(instruction, m),
  );

  // getTransactionEncoder().encode returns a ReadonlyUint8Array view — Privy's
  // signAndSendTransaction wants a real (mutable-typed) Uint8Array, hence the copy.
  return new Uint8Array(getTransactionEncoder().encode(compileTransaction(message)));
}
