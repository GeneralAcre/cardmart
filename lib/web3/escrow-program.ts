// Client-side builder for transactions targeting the real on-chain escrow
// program in contracts/escrow (Anchor/Rust). No @coral-xyz/anchor dependency
// here — the app already uses the lighter-weight @solana/kit everywhere
// else, so instructions are hand-built: Anchor's instruction discriminators
// (sha256("global:<name>")[0..8]) are precomputed constants below, and the
// only arguments any instruction here takes are fixed-width u64s, which
// Borsh encodes as plain little-endian bytes with no extra framing.
//
// The program id below is a PUBLIC address — safe to hardcode. The actual
// secrets (the program's upgrade authority, and the escrow authority used
// server-side in lib/web3/escrow-server.ts) are never in this repo; see
// contracts/escrow/README.md.
import {
  address,
  getAddressEncoder,
  getProgramDerivedAddress,
  appendTransactionMessageInstruction,
  compileTransaction,
  createSolanaRpc,
  createTransactionMessage,
  getTransactionEncoder,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  AccountRole,
  type Address,
  type Instruction,
} from "@solana/kit";

export const ESCROW_PROGRAM_ID = address(
  process.env.NEXT_PUBLIC_ESCROW_PROGRAM_ID ?? "11111111111111111111111111111111",
);
const SYSTEM_PROGRAM_ID = address("11111111111111111111111111111111");

// Same devnet cluster as everywhere else (lib/web3/solana-memo.ts, lib/solana.ts).
const rpc = createSolanaRpc("https://api.devnet.solana.com");

const addressEncoder = getAddressEncoder();

const DISCRIMINATOR = {
  initializeConfig: Uint8Array.of(208, 127, 21, 1, 194, 190, 196, 70),
  lockPayment: Uint8Array.of(170, 21, 188, 226, 187, 242, 186, 104),
  releaseToSeller: Uint8Array.of(218, 83, 41, 9, 49, 54, 255, 56),
  refundToBuyer: Uint8Array.of(56, 245, 60, 35, 59, 186, 39, 151),
} as const;

function u64LeBytes(value: bigint): Uint8Array {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, value, true);
  return bytes;
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Random u64 used only as PDA seed material — doesn't need to be unguessable, just unique per buyer. */
export function randomTradeId(): bigint {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getBigUint64(0, true);
}

export async function deriveConfigPda(): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: ESCROW_PROGRAM_ID,
    seeds: ["config"],
  });
  return pda;
}

export async function deriveTradePda(buyer: Address, tradeId: bigint): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: ESCROW_PROGRAM_ID,
    seeds: ["trade", addressEncoder.encode(buyer), u64LeBytes(tradeId)],
  });
  return pda;
}

async function buildTransaction(feePayer: Address, instruction: Instruction): Promise<Uint8Array> {
  const { value: latestBlockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(feePayer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
    (m) => appendTransactionMessageInstruction(instruction, m),
  );
  return new Uint8Array(getTransactionEncoder().encode(compileTransaction(message)));
}

/** Buyer-signed: locks `lamports` into a fresh Trade PDA. Returns the unsigned transaction bytes and the derived trade account. */
export async function buildLockPaymentTransaction(opts: {
  buyer: string;
  seller: string;
  tradeId: bigint;
  lamports: bigint;
}): Promise<{ transactionBytes: Uint8Array; tradeAccount: Address }> {
  const buyer = address(opts.buyer);
  const seller = address(opts.seller);
  const trade = await deriveTradePda(buyer, opts.tradeId);

  const data = concatBytes(DISCRIMINATOR.lockPayment, u64LeBytes(opts.tradeId), u64LeBytes(opts.lamports));

  const instruction: Instruction = {
    programAddress: ESCROW_PROGRAM_ID,
    accounts: [
      { address: buyer, role: AccountRole.WRITABLE_SIGNER },
      { address: seller, role: AccountRole.READONLY },
      { address: trade, role: AccountRole.WRITABLE },
      { address: SYSTEM_PROGRAM_ID, role: AccountRole.READONLY },
    ],
    data,
  };

  const transactionBytes = await buildTransaction(buyer, instruction);
  return { transactionBytes, tradeAccount: trade };
}

/**
 * Escrow-authority-signed instruction: pays the trade's locked lamports to
 * the seller and closes the account. Only ever built+signed server-side
 * (see lib/web3/escrow-server.ts) — never handed to a browser wallet.
 */
export async function buildReleaseToSellerInstruction(opts: {
  authority: string;
  buyer: string;
  seller: string;
  tradeId: bigint;
}): Promise<Instruction> {
  const authority = address(opts.authority);
  const buyer = address(opts.buyer);
  const seller = address(opts.seller);
  const config = await deriveConfigPda();
  const trade = await deriveTradePda(buyer, opts.tradeId);

  const data = concatBytes(DISCRIMINATOR.releaseToSeller, u64LeBytes(opts.tradeId));

  return {
    programAddress: ESCROW_PROGRAM_ID,
    accounts: [
      { address: authority, role: AccountRole.READONLY_SIGNER },
      { address: config, role: AccountRole.READONLY },
      { address: trade, role: AccountRole.WRITABLE },
      { address: buyer, role: AccountRole.WRITABLE },
      { address: seller, role: AccountRole.WRITABLE },
    ],
    data,
  };
}

/**
 * Escrow-authority-signed instruction: refunds the trade's full locked
 * balance back to the buyer and closes the account. Only ever built+signed
 * server-side (see lib/web3/escrow-server.ts) — never handed to a browser
 * wallet.
 */
export async function buildRefundToBuyerInstruction(opts: {
  authority: string;
  buyer: string;
  tradeId: bigint;
}): Promise<Instruction> {
  const authority = address(opts.authority);
  const buyer = address(opts.buyer);
  const config = await deriveConfigPda();
  const trade = await deriveTradePda(buyer, opts.tradeId);

  const data = concatBytes(DISCRIMINATOR.refundToBuyer, u64LeBytes(opts.tradeId));

  return {
    programAddress: ESCROW_PROGRAM_ID,
    accounts: [
      { address: authority, role: AccountRole.READONLY_SIGNER },
      { address: config, role: AccountRole.READONLY },
      { address: trade, role: AccountRole.WRITABLE },
      { address: buyer, role: AccountRole.WRITABLE },
    ],
    data,
  };
}
