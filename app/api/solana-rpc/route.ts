import { NextResponse, type NextRequest } from "next/server";

import { PRIVY_ENFORCED } from "@/lib/privy-server";
import { serverRpcUrl } from "@/lib/web3/rpc-url";

/**
 * Forwards the browser's Solana JSON-RPC calls to the private RPC endpoint
 * (SOLANA_RPC_URL), so its API key never reaches client code. Only the calls
 * a wallet needs to build, send and confirm transactions are allowed, and
 * only for signed-in visitors, so the endpoint can't be used as a free
 * general-purpose RPC on our quota.
 */
const ALLOWED_METHODS = new Set([
  "getLatestBlockhash",
  "isBlockhashValid",
  "sendTransaction",
  "simulateTransaction",
  "getSignatureStatuses",
  "getTransaction",
  "getFeeForMessage",
  "getRecentPrioritizationFees",
  "getAccountInfo",
  "getMultipleAccounts",
  "getBalance",
  "getTokenAccountsByOwner",
  "getTokenAccountBalance",
  "getMinimumBalanceForRentExemption",
  "getBlockHeight",
  "getSlot",
  "getEpochInfo",
  "getGenesisHash",
  "getVersion",
  "getHealth",
]);
const MAX_BODY_BYTES = 64 * 1024;
const MAX_BATCH = 5;

type RpcCall = { jsonrpc?: string; id?: unknown; method?: unknown };

export async function POST(request: NextRequest) {
  // Same session check the rest of the site uses at the edge (proxy.ts);
  // wallet transactions only happen after sign-in anyway.
  if (PRIVY_ENFORCED && !request.cookies.get("privy-token")?.value) {
    return NextResponse.json({ error: "Sign in to use the wallet." }, { status: 401 });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: "Request too large." }, { status: 413 });

  let body: RpcCall | RpcCall[];
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const calls = Array.isArray(body) ? body : [body];
  if (calls.length === 0 || calls.length > MAX_BATCH) {
    return NextResponse.json({ error: "Too many calls in one request." }, { status: 400 });
  }
  const blocked = calls.find((c) => typeof c.method !== "string" || !ALLOWED_METHODS.has(c.method));
  if (blocked) {
    return NextResponse.json(
      { jsonrpc: "2.0", id: blocked.id ?? null, error: { code: -32601, message: "Method not allowed." } },
      { status: 403 },
    );
  }

  const upstream = await fetch(serverRpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw,
    cache: "no-store",
  });
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json", "Cache-Control": "no-store" },
  });
}
