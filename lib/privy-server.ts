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

/**
 * Resolves the signed-in Privy user from the `privy-id-token` cookie the
 * Privy client SDK sets in the browser. Returns null if there's no session
 * — callers decide what to do about that (redirect, etc.), this just reads.
 */
export async function getPrivySessionUser(): Promise<PrivyUser | null> {
  if (!PRIVY_ENFORCED) return null;

  const cookieStore = await cookies();
  const idToken = cookieStore.get("privy-id-token")?.value;
  if (!idToken) return null;

  try {
    return await getPrivyClient().getUser({ idToken });
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
