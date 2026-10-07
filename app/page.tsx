import { redirect } from "next/navigation";

import { PRIVY_ENFORCED, verifyPrivySession } from "@/lib/privy-server";
import { LandingPage } from "@/components/landing/landing-page";
import { getLandingShowcase } from "@/lib/queries";

export const metadata = {
  title: "CardMart — Collectibles Marketplace & Digital Certificate Vault",
};

// Public marketing page at "/" — proxy.ts lists it in PUBLIC_PATHS, and it's
// the ONLY sign-in surface in the app (there's no separate /login route);
// unauthenticated visits to any gated page land here. Always renders,
// signed in or not — it doesn't auto-redirect a returning signed-in visitor
// away, it just swaps the CTA (Login -> marketplace) so "/" stays the
// one stable landing spot.
export default async function RootPage() {
  if (!PRIVY_ENFORCED) redirect("/marketplace"); // demo mode: no real signed-out state to show

  // The card wall is decoration — if the database is unreachable the hero
  // still renders, just without cards behind it.
  const [session, showcase] = await Promise.all([
    verifyPrivySession(),
    getLandingShowcase().catch(() => []),
  ]);
  return <LandingPage authenticated={Boolean(session)} showcase={showcase} />;
}
