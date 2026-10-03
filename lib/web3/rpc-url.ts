// The one place the Solana RPC endpoint is configured, for browser and server
// code alike. The public devnet endpoint rate-limits hard (HTTP 429), which
// can stall a transaction mid-demo, so set NEXT_PUBLIC_SOLANA_RPC_URL to a
// dedicated devnet RPC (e.g. Helius: https://devnet.helius-rpc.com/?api-key=…).
// It ships to the browser by design — restrict the key to your domains in the
// provider's dashboard. SOLANA_RPC_URL optionally gives the server its own.
import { createSolanaRpc } from "@solana/kit";

const PUBLIC_DEVNET = "https://api.devnet.solana.com";

export const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim() || PUBLIC_DEVNET;

/** The WebSocket form of the same endpoint (https → wss), for subscriptions. */
export const SOLANA_WS_URL = SOLANA_RPC_URL.replace(/^http/, "ws");

/** RPC client for browser-side code (wallet transactions, balances). */
export function createClientRpc() {
  return createSolanaRpc(SOLANA_RPC_URL);
}

/** RPC client for server-side code: SOLANA_RPC_URL if set, else the shared one. */
export function createServerRpc() {
  return createSolanaRpc(process.env.SOLANA_RPC_URL?.trim() || SOLANA_RPC_URL);
}
