"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { CardWall } from "@/components/landing/card-wall";
import { ConfidenceWords } from "@/components/landing/confidence-words";
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
  // A visitor can look around the market first and sign in whenever they like.
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row">
      <LoginButton className={className} label="Login" />
      <Button asChild size="lg" variant="outline" className={className}>
        <Link href="/marketplace">{t.cta.browseMarketplace}</Link>
      </Button>
    </div>
  );
}

// The hero headline: a green shine in the brand highlight color sweeps
// across both lines every 5 seconds, then the text rests in its normal
// colors. Off for visitors who ask for reduced motion (see globals.css).
const foil = (base: string) =>
  `linear-gradient(110deg, ${base} 40%, var(--highlight) 50%, ${base} 60%)`;

function HeroTitle({ line1, line2 }: { line1: string; line2: string }) {
  // bg-clip-text only paints inside each line's box, and Thai tone marks and
  // lower vowels reach outside it — so each line gets extra room to paint
  // into (py) that the negative margin takes back out of the layout.
  const shine =
    "animate-text-sweep inline-block bg-[length:250%_100%] bg-clip-text bg-[position:0%_0] py-[0.18em] -my-[0.18em] text-transparent";
  return (
    <h1 className="text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-6xl sm:leading-[1.02] lg:text-7xl hero-title">
      <span className={shine} style={{ backgroundImage: foil("var(--foreground)") }}>
        {line1}
      </span>
      <br />
      <span className={shine} style={{ backgroundImage: foil("var(--muted-foreground)") }} data-muted>
        {line2}
      </span>
    </h1>
  );
}


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
          <HeroTitle line1={t.hero.titleLine1} line2={t.hero.titleLine2} />
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
        {/* Numbered steps: a big numeral (the same font as the app's other numbers), the title, thin glowing rules between. */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-3">
          {t.pillars.items.map((item, i) => (
            <div key={item.title} className="relative flex flex-col items-center px-6 py-10 text-center md:py-6">
              {i > 0 && (
                <>
                  <span
                    aria-hidden
                    className="via-foreground/40 absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent to-transparent md:hidden"
                  />
                  <span
                    aria-hidden
                    className="via-foreground/40 absolute inset-y-0 left-0 hidden w-px bg-gradient-to-b from-transparent to-transparent md:block"
                  />
                </>
              )}
              <span className="text-6xl leading-none font-bold tracking-tight tabular-nums sm:text-7xl">{i + 1}</span>
              <h3 className="mt-8 text-xl font-medium tracking-tight text-balance">{item.title}</h3>
            </div>
          ))}
        </div>
      </section>

      <ConfidenceWords />

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
