import "server-only";
import { cookies } from "next/headers";
import { PrivyClient, type User as PrivyUser } from "@privy-io/server-auth";

export const PRIVY_ENFORCED = Boolean(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID && process.env.PRIVY_APP_SECRET,
);

let client: PrivyClient | null = null;

function getPrivyClient(): PrivyClient {
  if (!client) {
    client = new PrivyClient(process.env.NEXT_PUBLIC_PRIVY_APP_ID!, process.env.PRIVY_APP_SECRET!);
  }
  return client;
}

// The actual cookie the Privy client SDK sets in the browser is
// "privy-token" (a verifiable JWT) — NOT "privy-id-token" as an example in
// @privy-io/server-auth's own JSDoc suggests. Confirmed by inspecting the
// real cookies written in a browser session; using the wrong name meant
// getPrivySessionUser() always returned null server-side even though the
// client considered itself authenticated, producing an infinite redirect
// loop back to /login.
const SESSION_COOKIE = "privy-token";

/**
 * Resolves the signed-in Privy user from the session cookie the Privy
 * client SDK sets in the browser. Returns null if there's no session —
 * callers decide what to do about that (redirect, etc.), this just reads.
 */
export async function getPrivySessionUser(): Promise<PrivyUser | null> {
  if (!PRIVY_ENFORCED) return null;

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const claims = await getPrivyClient().verifyAuthToken(token);
    // Rate-limited per Privy's own docs, but fine at this app's scale —
    // avoids needing the separate privy-id-token cookie for the richer
    // getUser({idToken}) lookup, since that cookie isn't actually set.
    return await getPrivyClient().getUser(claims.userId);
  } catch {
    return null;
  }
}

/** The Solana wallet address from a Privy user's most recently linked wallet, if any. */
export function primarySolanaWallet(privyUser: PrivyUser): string | null {
  if (privyUser.wallet?.chainType === "solana") return privyUser.wallet.address;
  const solanaAccount = privyUser.linkedAccounts.find(
    (a) => a.type === "wallet" && a.chainType === "solana",
  );
  return solanaAccount && "address" in solanaAccount ? solanaAccount.address : null;
}
