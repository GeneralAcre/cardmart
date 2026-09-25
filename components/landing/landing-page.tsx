"use client";

import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { LandingNav } from "@/components/landing/landing-nav";
import { LoginButton } from "@/components/onboarding/login-button";
import { LanguageProvider, useLanguage } from "@/components/landing/language-provider";

// One CTA, two states: a real Privy login for a guest, a plain link onward
// for someone already signed in — "/" never redirects them away, it just
// swaps what the button does. Full-width on mobile (thumb-friendly), auto
// width from sm: up — the pattern most mobile-first apps use for a primary
// action button.
function LandingCta({ authenticated, className }: { authenticated: boolean; className?: string }) {
  const { t } = useLanguage();

  if (authenticated) {
    return (
      <Button asChild size="lg" className={className}>
        <Link href="/marketplace">
          {t.nav.goToMarketplace}
        </Link>
      </Button>
    );
  }
  return <LoginButton className={className} label="Login" />;
}

function LandingPageContent({ authenticated }: { authenticated: boolean }) {
  const { t } = useLanguage();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <LandingNav authenticated={authenticated} />

      <div className="relative overflow-hidden border-b bg-[radial-gradient(120%_140%_at_50%_-10%,rgba(255,255,255,0.08),transparent_60%)] sm:bg-[radial-gradient(120%_140%_at_10%_-10%,rgba(255,255,255,0.08),transparent_60%)]">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 py-14 text-center sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)] lg:py-24 lg:text-left">
          <div className="flex flex-col items-center gap-6 lg:items-start">
            <h1 className="max-w-3xl text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-6xl sm:leading-[1.02] lg:text-7xl">
              {t.hero.titleLine1}
              <br />
              <span className="text-muted-foreground">{t.hero.titleLine2}</span>
            </h1>
            <p className="text-muted-foreground max-w-xl text-base text-balance sm:text-lg">{t.hero.subtitle}</p>
            <div className="flex w-full flex-col items-center gap-2.5 pt-2 sm:w-auto lg:items-start">
              <LandingCta authenticated={authenticated} className="w-full px-8 sm:w-auto" />
              {!authenticated && <span className="text-muted-foreground text-xs">{t.hero.noWalletNote}</span>}
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-[18rem] lg:max-w-[22rem]">
            <div className="bg-highlight/25 absolute inset-[12%] rounded-full blur-3xl" aria-hidden />
            <Image
              src="/pikachu-cgc.jpg"
              alt="CGC-certified Pikachu trading card"
              width={343}
              height={583}
              priority
              className="relative h-auto w-full drop-shadow-[0_20px_35px_rgba(170,204,0,0.22)]"
            />
          </div>
        </div>
      </div>

    </div>
  );
}

export function LandingPage({ authenticated }: { authenticated: boolean }) {
  return (
    <LanguageProvider>
      <LandingPageContent authenticated={authenticated} />
    </LanguageProvider>
  );
}
