// Client-side, owner-signed builders for the two SPL Token instructions that
// let the platform's escrow authority move a digital-twin token on the
// owner's behalf later (see lib/web3/token-server.ts for why: settlement is
// triggered by an admin/system action, not a live browser session, so a
// one-time delegate approval at listing time stands in for a bespoke vault
// program). Same unsigned-bytes-for-Privy-to-sign pattern as
// lib/web3/solana-memo.ts and lib/web3/solana-transfer.ts.
import {
  address,
  appendTransactionMessageInstruction,
  appendTransactionMessageInstructions,
  compileTransaction,
  createNoopSigner,
  createSolanaRpc,
  createTransactionMessage,
  getTransactionEncoder,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
} from "@solana/kit";
import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getApproveCheckedInstruction,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  getRevokeInstruction,
} from "@solana-program/token";

const DECIMALS = 0;
const APPROVE_AMOUNT = BigInt(1);

// Same devnet cluster as everywhere else (lib/web3/solana-memo.ts, lib/solana.ts).
const rpc = createSolanaRpc("https://api.devnet.solana.com");

/**
 * Owner-signed: delegates `delegate` (the platform's escrow authority) as a
 * 1-token spender over the owner's own digital-twin token account. Required
 * before the platform can settle a real sale of this asset — see
 * lib/web3/token-server.ts::transferDigitalTwinToken.
 */
export async function buildApproveDelegateTransaction(opts: {
  owner: string;
  mintAddress: string;
  delegate: string;
}): Promise<Uint8Array> {
  const owner = address(opts.owner);
  const mint = address(opts.mintAddress);
  const delegate = address(opts.delegate);
  const [ownerAta] = await findAssociatedTokenPda({ owner, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });

  const createAta = await getCreateAssociatedTokenIdempotentInstructionAsync({
    payer: createNoopSigner(owner),
    owner,
    mint,
  });
  const approve = getApproveCheckedInstruction({
    source: ownerAta,
    mint,
    delegate,
    owner: createNoopSigner(owner),
    amount: APPROVE_AMOUNT,
    decimals: DECIMALS,
  });

  const { value: latestBlockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(owner, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
    (m) => appendTransactionMessageInstructions([createAta, approve], m),
  );
  return new Uint8Array(getTransactionEncoder().encode(compileTransaction(message)));
}

/**
 * Owner-signed: revokes any standing delegate approval on the owner's
 * digital-twin token account (called on delist, closing the window where a
 * delisted item could still be moved by the platform).
 */
export async function buildRevokeTransaction(opts: { owner: string; mintAddress: string }): Promise<Uint8Array> {
  const owner = address(opts.owner);
  const mint = address(opts.mintAddress);
  const [ownerAta] = await findAssociatedTokenPda({ owner, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });

  const revoke = getRevokeInstruction({ source: ownerAta, owner: createNoopSigner(owner) });

  const { value: latestBlockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(owner, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
    (m) => appendTransactionMessageInstruction(revoke, m),
  );
  return new Uint8Array(getTransactionEncoder().encode(compileTransaction(message)));
}
