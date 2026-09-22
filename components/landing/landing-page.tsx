"use client";

import Link from "next/link";
import { ArrowRight, BadgeCheck, Gem, Sparkles } from "lucide-react";
import {
  ShieldCheck,
  Vault,
  Camera,
  ScanSearch,
  Wallet,
  Truck,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { LandingNav } from "@/components/landing/landing-nav";
import { LoginButton } from "@/components/onboarding/login-button";
import { SiteFooter } from "@/components/site/footer";
import { LanguageProvider, useLanguage } from "@/components/landing/language-provider";

const FEATURE_ICONS: LucideIcon[] = [ShieldCheck, Vault, Camera, ScanSearch, Wallet, Truck];

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
          {t.nav.goToMarketplace} <ArrowRight />
        </Link>
      </Button>
    );
  }
  return <LoginButton className={className} />;
}

function LandingPageContent({ authenticated }: { authenticated: boolean }) {
  const { t } = useLanguage();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <LandingNav authenticated={authenticated} />

      <div className="relative overflow-hidden border-b bg-[radial-gradient(120%_140%_at_50%_-10%,rgba(255,255,255,0.08),transparent_60%)] sm:bg-[radial-gradient(120%_140%_at_10%_-10%,rgba(255,255,255,0.08),transparent_60%)]">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 py-14 text-center sm:items-start sm:px-6 sm:py-28 sm:text-left">
          <span className="bg-foreground text-background inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
            <Gem className="size-3.5" />
            {t.hero.badge}
          </span>
          <h1 className="max-w-3xl text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-6xl sm:leading-[1.02] lg:text-7xl">
            {t.hero.titleLine1}
            <br />
            <span className="text-muted-foreground">{t.hero.titleLine2}</span>
          </h1>
          <p className="text-muted-foreground max-w-xl text-base text-balance sm:text-lg">{t.hero.subtitle}</p>
          <div className="flex w-full flex-col items-center gap-2.5 pt-2 sm:w-auto sm:items-start">
            <LandingCta authenticated={authenticated} className="w-full px-8 sm:w-auto" />
            {!authenticated && <span className="text-muted-foreground text-xs">{t.hero.noWalletNote}</span>}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-20">
        <div className="mb-8 flex flex-col gap-3 sm:mb-10">
          <span className="bg-foreground text-background w-fit rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
            {t.features.badge}
          </span>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t.features.title}</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {t.features.items.map((f, i) => {
            const Icon = FEATURE_ICONS[i];
            return (
              <div
                key={f.title}
                className="bg-card flex flex-col gap-3 rounded-xl border p-5 transition-shadow sm:hover:shadow-md"
              >
                <div className="bg-foreground text-background flex size-10 items-center justify-center rounded-lg">
                  <Icon className="size-5" />
                </div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="text-muted-foreground text-sm">{f.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-y bg-[color-mix(in_oklch,var(--muted)_40%,transparent)]">
        <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-20">
          <div className="mb-8 flex flex-col gap-3 sm:mb-10">
            <span className="bg-foreground text-background w-fit rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
              {t.steps.badge}
            </span>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t.steps.title}</h2>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-4">
            {t.steps.items.map((step, i) => (
              <div key={step.title} className="flex flex-col gap-2">
                <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-full text-sm font-semibold">
                  {i + 1}
                </div>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="text-muted-foreground text-sm">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-4 py-14 text-center sm:px-6 sm:py-24">
        <div className="bg-foreground text-background flex size-14 items-center justify-center rounded-full">
          <Sparkles className="size-7" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {authenticated ? t.closing.titleAuthenticated : t.closing.titleGuest}
        </h2>
        <p className="text-muted-foreground max-w-md text-sm text-balance">
          {authenticated ? t.closing.subtitleAuthenticated : t.closing.subtitleGuest}
        </p>
        <LandingCta authenticated={authenticated} className="w-full max-w-xs px-8 sm:w-auto" />
        {!authenticated && (
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <BadgeCheck className="size-3.5" />
            {t.closing.freeSignInNote}
          </span>
        )}
      </div>

      <SiteFooter />
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
