import "server-only";
import { address, createSolanaRpc, lamports as toLamports } from "@solana/kit";

const LAMPORTS_PER_SOL = 1_000_000_000;
const MAX_AIRDROP_SOL = 2;

// Same cluster the embedded wallets are pointed at (see
// components/providers/privy-provider.tsx) — a Solana address itself isn't
// network-specific, but the balance you get back absolutely is, so this
// has to match wherever the user actually deposited funds.
const rpc = createSolanaRpc("https://api.devnet.solana.com");

/**
 * Real devnet SOL balance for a wallet address, in SOL (not lamports).
 * Returns null if there's no address or the RPC call fails — callers
 * should treat that as "unknown," not "zero."
 */
export async function getDevnetSolBalance(walletAddress: string | null): Promise<number | null> {
  if (!walletAddress) return null;

  try {
    const { value: lamports } = await rpc.getBalance(address(walletAddress)).send();
    return Number(lamports) / LAMPORTS_PER_SOL;
  } catch {
    return null;
  }
}

/**
 * "Deposit" on devnet, in practice: there's no real money to move, so this
 * hits Solana's devnet faucet directly and mints real (if worthless) devnet
 * SOL straight into the wallet — an actual RPC call and an actual balance
 * change, not a simulated one. Capped and clamped; the devnet faucet itself
 * is also rate-limited per address/IP, which surfaces as a thrown error.
 */
export async function requestDevnetAirdrop(walletAddress: string, amountSol: number): Promise<string> {
  const clamped = Math.min(Math.max(amountSol, 0.01), MAX_AIRDROP_SOL);
  const lamportsAmount = toLamports(BigInt(Math.round(clamped * LAMPORTS_PER_SOL)));
  return rpc.requestAirdrop(address(walletAddress), lamportsAmount, { commitment: "confirmed" }).send();
}
