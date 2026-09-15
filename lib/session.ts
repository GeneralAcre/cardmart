import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { PRIVY_ENFORCED, getPrivySessionUser, primarySolanaWallet } from "@/lib/privy-server";

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
    return prisma.user.findUniqueOrThrow({ where: { handle: "you" } });
  }

  const privyUser = await getPrivySessionUser();
  if (!privyUser) redirect("/login");

  const existing = await prisma.user.findUnique({ where: { privyUserId: privyUser.id } });
  if (existing) return existing;

  // First time we've seen this Privy identity — create our own row for it.
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
 * Gates /admin/warehouse and its Server Actions to staff only. Redirects
 * non-admins to "/" rather than showing a 403 — this is a warehouse ops
 * tool, not a page regular users have any reason to land on or discover
 * exists. Call this at the top of the page AND inside every warehouse/
 * grading Server Action — the page check alone doesn't stop someone from
 * calling an action directly.
 */
export const requireAdmin = cache(async () => {
  const user = await getCurrentUser();
  if (!user.isAdmin) redirect("/");
  return user;
});
