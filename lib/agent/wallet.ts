import "server-only";
// The buying agent's own wallet — one Solana keypair per user, created the
// first time they open /agent. The user funds it from their Privy wallet, and
// the agent pays for purchases from it without a wallet popup, which is what
// lets it buy while the user is away. Its balance is the hard on-chain cap on
// what the agent can spend; the limits on each mandate sit on top of that.
//
// The platform authority pays every transaction fee, so the agent wallet
// only ever needs the purchase amount itself (plus the Trade account rent,
// which comes back when the trade closes).
//
// The 32-byte private key is stored AES-256-GCM encrypted with a key derived
// from AGENT_WALLET_SECRET. Without that env var (or without the escrow
// authority), agent purchases fall back to the same simulated escrow the rest
// of the app uses when the chain isn't configured.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { address, createNoopSigner, lamports as toLamports } from "@solana/kit";
import { createKeyPairFromPrivateKeyBytes } from "@solana/keys";
import { getAddressFromPublicKey } from "@solana/addresses";
import { getTransferSolInstruction } from "@solana-program/system";

import { prisma } from "@/lib/prisma";
import { getEscrowAuthorityAddress, rpc, signAndSend } from "@/lib/web3/authority-server";
import { buildLockPaymentInstruction, buildServiceFeeInstruction, randomTradeId } from "@/lib/web3/escrow-program";

const LAMPORTS_PER_SOL = BigInt(1_000_000_000);
// Covers the Trade account's rent on top of the locked amount.
const LOCK_HEADROOM_LAMPORTS = BigInt(3_000_000);

function encryptionKey(): Buffer | null {
  const secret = process.env.AGENT_WALLET_SECRET;
  return secret ? createHash("sha256").update(secret).digest() : null;
}

function encrypt(plain: Uint8Array, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString("base64")).join(".");
}

function decrypt(payload: string, key: Buffer): Uint8Array {
  const [iv, tag, body] = payload.split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return new Uint8Array(Buffer.concat([decipher.update(body), decipher.final()]));
}

/** True when agent purchases can move real devnet SOL (otherwise they're simulated). */
export async function isAgentChainEnabled(): Promise<boolean> {
  return Boolean(encryptionKey()) && Boolean(await getEscrowAuthorityAddress());
}

/** The user's agent wallet, created on first use. Returns null when agent wallets aren't configured. */
export async function getOrCreateAgentWallet(userId: string) {
  const existing = await prisma.agentWallet.findUnique({ where: { userId } });
  if (existing) return existing;

  const key = encryptionKey();
  if (!key) return null;
  const seed = new Uint8Array(randomBytes(32));
  const keyPair = await createKeyPairFromPrivateKeyBytes(seed);
  const walletAddress = await getAddressFromPublicKey(keyPair.publicKey);
  try {
    return await prisma.agentWallet.create({
      data: { userId, address: walletAddress, encryptedSecret: encrypt(seed, key) },
    });
  } catch {
    // Two tabs raced to create it — use whichever won.
    return prisma.agentWallet.findUniqueOrThrow({ where: { userId } });
  }
}

async function loadAgentKeyPair(wallet: { encryptedSecret: string }): Promise<CryptoKeyPair> {
  const key = encryptionKey();
  if (!key) throw new Error("AGENT_WALLET_SECRET is not configured.");
  return createKeyPairFromPrivateKeyBytes(decrypt(wallet.encryptedSecret, key));
}

export async function getAgentBalanceLamports(walletAddress: string): Promise<bigint> {
  const { value } = await rpc.getBalance(address(walletAddress), { commitment: "confirmed" }).send();
  return BigInt(value);
}

export function lamportsToSol(value: bigint): number {
  return Number(value) / Number(LAMPORTS_PER_SOL);
}

/**
 * Locks `lamports` in the escrow program with the agent wallet as the buyer —
 * the same lock_payment a browser wallet signs on the item page, just signed
 * here. Throws if the wallet can't cover it.
 */
export async function agentLockPayment(opts: {
  wallet: { address: string; encryptedSecret: string };
  sellerWalletAddress: string;
  lamports: bigint;
  /** Buyer-protection fee, paid to the platform in the same transaction. */
  feeLamports?: bigint;
}): Promise<{ tradeId: string; txSignature: string; lamports: string; tradeAccount: string }> {
  const authority = await getEscrowAuthorityAddress();
  if (!authority) throw new Error("The escrow authority isn't configured.");

  const fee = opts.feeLamports ?? BigInt(0);
  const balance = await getAgentBalanceLamports(opts.wallet.address);
  if (balance < opts.lamports + fee + LOCK_HEADROOM_LAMPORTS) {
    const short = lamportsToSol(opts.lamports + fee + LOCK_HEADROOM_LAMPORTS - balance);
    throw new Error(`Your agent wallet needs about ${short.toFixed(3)} more SOL for this purchase.`);
  }

  const tradeId = randomTradeId();
  const { instruction, tradeAccount } = await buildLockPaymentInstruction({
    buyer: opts.wallet.address,
    seller: opts.sellerWalletAddress,
    tradeId,
    lamports: opts.lamports,
  });
  const feeInstruction =
    fee > BigInt(0) ? [buildServiceFeeInstruction({ buyer: opts.wallet.address, platform: authority, lamports: fee })] : [];
  const keyPair = await loadAgentKeyPair(opts.wallet);
  const txSignature = await signAndSend([...feeInstruction, instruction], authority, [keyPair]);
  return { tradeId: tradeId.toString(), txSignature, lamports: opts.lamports.toString(), tradeAccount };
}

/**
 * Pays a buying-agent task's flat fee from the agent wallet to the platform
 * authority. Throws if the wallet can't cover it and still stay usable.
 */
export async function payAgentTaskFee(
  wallet: { address: string; encryptedSecret: string },
  lamports: bigint,
): Promise<string> {
  const authority = await getEscrowAuthorityAddress();
  if (!authority) throw new Error("The escrow authority isn't configured.");

  const balance = await getAgentBalanceLamports(wallet.address);
  // Leaves enough behind that the wallet stays rent-exempt.
  if (balance < lamports + LOCK_HEADROOM_LAMPORTS) {
    const short = lamportsToSol(lamports + LOCK_HEADROOM_LAMPORTS - balance);
    throw new Error(`Add about ${short.toFixed(3)} more SOL to your agent wallet to pay the task fee.`);
  }

  const instruction = getTransferSolInstruction({
    source: createNoopSigner(address(wallet.address)),
    destination: address(authority),
    amount: toLamports(lamports),
  });
  const keyPair = await loadAgentKeyPair(wallet);
  return signAndSend([instruction], authority, [keyPair]);
}

/** Sends the agent wallet's whole balance back to the user's own wallet. */
export async function withdrawAgentBalance(
  wallet: { address: string; encryptedSecret: string },
  toWalletAddress: string,
): Promise<{ signature: string; sol: number } | null> {
  const authority = await getEscrowAuthorityAddress();
  if (!authority) throw new Error("The escrow authority isn't configured.");
  const balance = await getAgentBalanceLamports(wallet.address);
  if (balance === BigInt(0)) return null;

  const instruction = getTransferSolInstruction({
    source: createNoopSigner(address(wallet.address)),
    destination: address(toWalletAddress),
    amount: toLamports(balance),
  });
  const keyPair = await loadAgentKeyPair(wallet);
  const signature = await signAndSend([instruction], authority, [keyPair]);
  return { signature, sol: lamportsToSol(balance) };
}
