"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { LoginButton } from "@/components/onboarding/login-button";
import { LanguageSwitcher } from "@/components/landing/language-switcher";
import { useLanguage } from "@/components/landing/language-provider";

// There's no separate /login route — this triggers the real Privy sign-in
// directly, same button as the hero/closing CTA, just sized for the nav.
// One login surface for the whole app: the landing page itself.
export function LandingNav({ authenticated }: { authenticated: boolean }) {
  const { t } = useLanguage();

  return (
    <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span>CardMart</span>
        </Link>
        <div className="flex items-center gap-2">
          {authenticated ? (
            <Button asChild size="sm">
              <Link href="/marketplace">{t.nav.goToMarketplace}</Link>
            </Button>
          ) : (
            <LoginButton size="sm" className="w-auto" label="Login" />
          )}
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
