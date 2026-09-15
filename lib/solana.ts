import "server-only";
import { address, createSolanaRpc } from "@solana/kit";

const LAMPORTS_PER_SOL = 1_000_000_000;

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
