import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { LoginButton } from "@/components/onboarding/login-button";
import { WalletLoginButton } from "@/components/onboarding/wallet-login-button";
import { StaffSignOut } from "@/components/backoffice/staff-sign-out";
import { prisma } from "@/lib/prisma";
import { PRIVY_ENFORCED, verifyPrivySession } from "@/lib/privy-server";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "CardMart Back Office",
  robots: { index: false, follow: false },
};

// The back office's own sign-in page — the landing page at "/" is the
// marketplace's sign-in, and on the admin domain "/" is rewritten here
// instead (see proxy.ts). Staff who are already signed in go straight in.
export default async function StaffLoginPage() {
  if (!PRIVY_ENFORCED) redirect("/admin"); // demo mode: the seeded demo user is staff

  const session = await verifyPrivySession();
  const user = session
    ? await prisma.user.findUnique({ where: { privyUserId: session.userId }, select: { isAdmin: true, email: true } })
    : null;
  if (user?.isAdmin) redirect("/admin");

  const t = await getT();

  return (
    <main className="flex min-h-screen flex-1 items-center justify-center px-4">
      <div className="bg-card flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl border p-8 text-center">
        <span className="bg-highlight text-highlight-foreground flex size-12 items-center justify-center rounded-xl">
          <ShieldCheck className="size-6" />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-bold tracking-wide uppercase">CardMart</h1>
          <p className="text-muted-foreground text-sm">{t("Back Office")}</p>
        </div>

        {session ? (
          // Signed in, but not a staff account (or it has never finished
          // onboarding on the marketplace).
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm">
              {t("{email} doesn't have staff access.", { email: user?.email ?? t("This account") })}
            </p>
            <StaffSignOut variant="outline" />
          </div>
        ) : (
          <>
            <p className="text-muted-foreground text-sm">{t("Staff only. Sign in with your CardMart account.")}</p>
            <LoginButton redirectTo="/admin" />
            <WalletLoginButton redirectTo="/admin" />
          </>
        )}
      </div>
    </main>
  );
}
