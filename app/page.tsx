import { redirect } from "next/navigation";

import { PRIVY_ENFORCED, getPrivySessionUser } from "@/lib/privy-server";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata = {
  title: "Proof — Collectibles Marketplace & Digital Twin Vault",
};

// Public marketing page at "/" — proxy.ts lists it in PUBLIC_PATHS, and it's
// the ONLY sign-in surface in the app (there's no separate /login route);
// unauthenticated visits to any gated page land here. Always renders,
// signed in or not — it doesn't auto-redirect a returning signed-in visitor
// away, it just swaps the CTA (Log In -> Go to Marketplace) so "/" stays the
// one stable landing spot.
export default async function RootPage() {
  if (!PRIVY_ENFORCED) redirect("/marketplace"); // demo mode: no real signed-out state to show

  const user = await getPrivySessionUser();
  return <LandingPage authenticated={Boolean(user)} />;
}
