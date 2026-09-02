import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const AUTH_ENFORCED = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

// Google sign-in is wired up but not enforced yet (see proxy.ts) — until
// real AUTH_GOOGLE_ID/SECRET are configured, every page acts as the seeded
// "you" demo user so the rest of the app stays usable. Once enforced, this
// resolves the real signed-in + onboarded user instead, matching proxy.ts's
// own redirect conditions as defense in depth.
export const getCurrentUser = cache(async () => {
  if (!AUTH_ENFORCED) {
    return prisma.user.findUniqueOrThrow({ where: { handle: "you" } });
  }

  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");
  if (!user.profileComplete) redirect("/onboarding");

  return user;
});
