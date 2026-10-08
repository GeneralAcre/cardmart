"use client";

import Link from "next/link";
import { BadgeCheck, ChartNoAxesCombined, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CardWall } from "@/components/landing/card-wall";
import { FeatureShowcase } from "@/components/landing/feature-showcase";
import type { LandingShowcaseItem } from "@/lib/queries";
import { LandingNav } from "@/components/landing/landing-nav";
import { LoginButton } from "@/components/onboarding/login-button";
import { useLanguage } from "@/components/landing/language-provider";

// One CTA, two states: a real Privy login for a guest, a plain link onward
// for someone already signed in — "/" never redirects them away, it just
// swaps what the button does. Sized to its label on every screen — a
// full-width bar read as heavy on phones.
function LandingCta({ authenticated, className }: { authenticated: boolean; className?: string }) {
  const { t } = useLanguage();

  if (authenticated) {
    return (
      <Button asChild size="lg" className={className}>
        <Link href="/marketplace">
          {t.cta.enterMarketplace}
        </Link>
      </Button>
    );
  }
  return <LoginButton className={className} label="Login" />;
}

// Same order as t.pillars.items: market data, safe trading, ownership.
const PILLAR_ICONS = [ChartNoAxesCombined, ShieldCheck, BadgeCheck];

interface LandingPageProps {
  authenticated: boolean;
  showcase: LandingShowcaseItem[];
}

function LandingPageContent({ authenticated, showcase }: LandingPageProps) {
  const { t } = useLanguage();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <LandingNav authenticated={authenticated} />

      <div className="relative isolate flex min-h-[85svh] items-center overflow-hidden border-b">
        <CardWall items={showcase} />
        {/* Dim the wall, darkest in the middle where the text sits. */}
        <div
          aria-hidden
          className="bg-background/75 absolute inset-0 bg-[radial-gradient(60%_55%_at_50%_50%,var(--background)_0%,transparent_100%)]"
        />
        <div aria-hidden className="from-background absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent" />
        <div aria-hidden className="from-background absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t to-transparent" />

        <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 py-20 text-center sm:px-6">
          <h1 className="text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-6xl sm:leading-[1.02] lg:text-7xl">
            {t.hero.titleLine1}
            <br />
            <span className="text-muted-foreground">{t.hero.titleLine2}</span>
          </h1>
          <p className="text-muted-foreground max-w-xl text-base text-balance sm:text-lg">{t.hero.subtitle}</p>
          <div className="flex flex-col items-center gap-2.5 pt-2">
            <LandingCta authenticated={authenticated} className="h-11 w-auto rounded-full px-8" />
            {!authenticated && <span className="text-muted-foreground text-xs">{t.hero.noWalletNote}</span>}
          </div>
        </div>
      </div>

      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <span className="border-highlight/30 bg-highlight/10 text-highlight rounded-full border px-3 py-1 text-xs font-medium">
            {t.pillars.badge}
          </span>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{t.pillars.title}</h2>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          {t.pillars.items.map((item, i) => {
            const Icon = PILLAR_ICONS[i];
            return (
              <div
                key={item.title}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent p-6 transition-colors hover:border-white/20 sm:p-7"
              >
                <div
                  aria-hidden
                  className="bg-highlight/20 absolute -top-16 -right-16 size-40 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
                />
                <span aria-hidden className="absolute top-5 right-6 font-mono text-5xl font-semibold text-white/[0.04]">
                  0{i + 1}
                </span>
                <div className="bg-highlight/10 text-highlight ring-highlight/20 flex size-10 items-center justify-center rounded-xl ring-1">
                  <Icon className="size-5" />
                </div>
                <h3 className="mt-6 text-lg font-semibold tracking-tight">{item.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{item.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <FeatureShowcase />

      <section className="relative isolate overflow-hidden border-t">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(50%_80%_at_50%_100%,color-mix(in_oklab,var(--highlight)_18%,transparent)_0%,transparent_100%)]"
        />
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 px-4 py-24 text-center sm:px-6 sm:py-32">
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
            {authenticated ? t.closing.titleAuthenticated : t.closing.titleGuest}
          </h2>
          <p className="text-muted-foreground text-balance">
            {authenticated ? t.closing.subtitleAuthenticated : t.closing.subtitleGuest}
          </p>
          <div className="flex flex-col items-center gap-2.5 pt-2">
            <LandingCta authenticated={authenticated} className="h-11 w-auto rounded-full px-8" />
            {!authenticated && <span className="text-muted-foreground text-xs">{t.closing.freeSignInNote}</span>}
          </div>
        </div>
      </section>
    </div>
  );
}

export function LandingPage(props: LandingPageProps) {
  return <LandingPageContent {...props} />;
}
