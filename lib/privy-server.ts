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
// verifyPrivySession() always returned null server-side even though the
// client considered itself authenticated, producing an infinite redirect
// loop back to /login.
const SESSION_COOKIE = "privy-token";

/**
 * Verifies the session cookie the Privy client SDK sets in the browser and
 * returns just the userId — no session means null. verifyAuthToken is a
 * local JWT signature check (the verification key is fetched from Privy
 * once per server process and cached after that per their own docs), so
 * this is fast and doesn't cost a Privy API round trip on every call.
 *
 * Deliberately does NOT fetch the full Privy profile (name/email/wallets) —
 * that's a real network call to Privy's API (see getPrivyUserProfile
 * below), and every page was previously paying for one on every single
 * load just to check "is someone signed in", even though only a brand-new
 * sign-up actually needs the profile data.
 */
export async function verifyPrivySession(): Promise<{ userId: string } | null> {
  if (!PRIVY_ENFORCED) return null;

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const claims = await getPrivyClient().verifyAuthToken(token);
    return { userId: claims.userId };
  } catch {
    return null;
  }
}

/**
 * Full Privy profile (name, email, linked wallets) — a real network call to
 * Privy's API (rate-limited per their own docs), unlike verifyPrivySession's
 * local JWT check. Only call this when the profile data is actually needed:
 * right now that's exactly once per identity, the first time it signs in
 * and we need to seed our own User row.
 */
export async function getPrivyUserProfile(userId: string): Promise<PrivyUser | null> {
  try {
    return await getPrivyClient().getUser(userId);
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
