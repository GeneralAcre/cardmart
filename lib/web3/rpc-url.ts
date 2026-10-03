// The one place the Solana RPC endpoint is configured. The public devnet
// endpoint rate-limits hard (HTTP 429), which can stall a transaction
// mid-demo, so set SOLANA_RPC_URL to a dedicated devnet RPC (e.g. Helius:
// https://devnet.helius-rpc.com/?api-key=…). It stays server-only: the
// browser talks to /api/solana-rpc (app/api/solana-rpc/route.ts), which
// forwards to it, so the API key never ships in client code.
import { createSolanaRpc } from "@solana/kit";

const PUBLIC_DEVNET = "https://api.devnet.solana.com";

/** The server's endpoint: the private SOLANA_RPC_URL, or public devnet. */
export function serverRpcUrl(): string {
  return process.env.SOLANA_RPC_URL?.trim() || PUBLIC_DEVNET;
}

/** The browser's endpoint: our own proxy, so the private key stays on the server. */
export const SOLANA_RPC_URL = typeof window !== "undefined" ? `${window.location.origin}/api/solana-rpc` : PUBLIC_DEVNET;

/**
 * WebSocket subscriptions (confirmation notices for wallet transactions)
 * can't go through the HTTP proxy, so they use public devnet — they only
 * listen, and every send and read still goes through the private RPC.
 */
export const SOLANA_WS_URL = "wss://api.devnet.solana.com";

/** RPC client for browser-side code (wallet transactions, balances). */
export function createClientRpc() {
  return createSolanaRpc(SOLANA_RPC_URL);
}

/** RPC client for server-side code. */
export function createServerRpc() {
  return createSolanaRpc(serverRpcUrl());
}
