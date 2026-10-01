import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { PRIVY_ENFORCED, getPrivyUserProfile, primarySolanaWallet, verifyPrivySession } from "@/lib/privy-server";

// Privy sign-in is wired up but not enforced until NEXT_PUBLIC_PRIVY_APP_ID
// and PRIVY_APP_SECRET are both configured — until then, every page acts as
// the seeded "you" demo user so the rest of the app stays usable.
//
// Finds or creates our own User row for the verified Privy identity, but
// does NOT enforce profileComplete — this is what /onboarding itself calls,
// since a profile obviously doesn't exist yet the first time someone lands
// there. Everything else should call getCurrentUser() below instead.
export const getSessionUser = cache(async () => {
  if (!PRIVY_ENFORCED) {
    // The demo user is an admin, so a deployment missing the Privy keys (a
    // Vercel preview with Production-only env vars, say) must not quietly
    // sign every visitor in as it. Only local dev falls back.
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_USER !== "true") {
      throw new Error("Sign-in isn't configured on this deployment: set NEXT_PUBLIC_PRIVY_APP_ID and PRIVY_APP_SECRET.");
    }
    return prisma.user.findUniqueOrThrow({ where: { handle: "you" } });
  }

  const session = await verifyPrivySession();
  // "/" not "/login" — there's no separate login page, the landing page IS
  // the sign-in surface.
  if (!session) redirect("/");

  // Fast path — every page load after the first hits this: a local JWT
  // check plus one DB lookup by an already-indexed column, no Privy API
  // call. Previously this called Privy's getUser() on every single page
  // load just to re-fetch a profile the vast majority of requests never
  // used, which meant every page paid for a Privy API round trip it didn't
  // need.
  const existing = await prisma.user.findUnique({ where: { privyUserId: session.userId } });
  if (existing) return existing;

  // First time we've seen this Privy identity — this is the one case that
  // actually needs the full profile (name/email/wallet) to seed our row.
  const privyUser = await getPrivyUserProfile(session.userId);
  if (!privyUser) redirect("/");

  return prisma.user.create({
    data: {
      privyUserId: privyUser.id,
      name: privyUser.google?.name ?? null,
      email: privyUser.email?.address ?? privyUser.google?.email ?? null,
      image: null,
      walletAddress: primarySolanaWallet(privyUser),
    },
  });
});

// The one most pages should use — same as getSessionUser but also redirects
// to /onboarding if the profile (shipping address, handle, etc.) isn't
// filled in yet. proxy.ts re-checks the same conditions at the edge as
// defense in depth, per Privy's own guidance not to rely on middleware alone.
export const getCurrentUser = cache(async () => {
  const user = await getSessionUser();
  if (!user.profileComplete) redirect("/onboarding");
  return user;
});

/**
 * Gates the /admin back office and its Server Actions to staff only. Answers
 * non-admins with a plain 404 rather than a 403 or a redirect, so the back
 * office looks exactly like a page that doesn't exist to anyone who
 * stumbles on the path. Call this at the top of the page AND inside every warehouse/
 * grading Server Action — the page check alone doesn't stop someone from
 * calling an action directly.
 */
export const requireAdmin = cache(async () => {
  const user = await getCurrentUser();
  if (!user.isAdmin) notFound();
  return user;
});
