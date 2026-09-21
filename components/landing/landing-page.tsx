import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  Gem,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Truck,
  Vault,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { LandingNav } from "@/components/landing/landing-nav";
import { LoginButton } from "@/components/onboarding/login-button";
import { SiteFooter } from "@/components/site/footer";

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Protected payments on every sale",
    description: "The buyer's payment is held safely until the item passes inspection at our warehouse.",
  },
  {
    icon: Vault,
    title: "Instant vault trading",
    description: "Items already in the vault transfer ownership instantly, with zero shipping fees.",
  },
  {
    icon: Camera,
    title: "Live camera verification",
    description: "Sellers prove physical possession with a live capture — no gallery uploads accepted.",
  },
  {
    icon: ScanSearch,
    title: "Real PSA cert lookups",
    description: "Certificate numbers are checked live against PSA's own public verification database.",
  },
  {
    icon: Wallet,
    title: "A real wallet, automatically",
    description: "Sign in with Google or email and a secure crypto wallet is created for you — no confusing setup.",
  },
  {
    icon: Truck,
    title: "Warehouse-inspected custody",
    description: "Physical items are verified at our warehouse before ownership ever changes hands.",
  },
];

const STEPS = [
  {
    title: "Sign in",
    description: "Google, email, or an existing wallet — a real Solana wallet is ready the moment you're in.",
  },
  {
    title: "Verify or send for grading",
    description: "Already certified? Verify it live on camera. Raw item? We ship it out for grading for you.",
  },
  {
    title: "List it for sale",
    description: "Set a price. Your digital certificate goes live on the marketplace, backed by the real item.",
  },
  {
    title: "Sell with payment protection",
    description: "The buyer's payment is held safely, the item is inspected, then it ships to them or joins the vault.",
  },
];

// One CTA, two states: a real Privy login for a guest, a plain link onward
// for someone already signed in — "/" never redirects them away, it just
// swaps what the button does. Full-width on mobile (thumb-friendly), auto
// width from sm: up — the pattern most mobile-first apps use for a primary
// action button.
function LandingCta({ authenticated, className }: { authenticated: boolean; className?: string }) {
  if (authenticated) {
    return (
      <Button asChild size="lg" className={className}>
        <Link href="/marketplace">
          Go to Marketplace <ArrowRight />
        </Link>
      </Button>
    );
  }
  return <LoginButton className={className} />;
}

export function LandingPage({ authenticated }: { authenticated: boolean }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <LandingNav authenticated={authenticated} />

      <div className="relative overflow-hidden border-b bg-[radial-gradient(120%_140%_at_50%_-10%,rgba(255,255,255,0.08),transparent_60%)] sm:bg-[radial-gradient(120%_140%_at_10%_-10%,rgba(255,255,255,0.08),transparent_60%)]">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 py-14 text-center sm:items-start sm:px-6 sm:py-28 sm:text-left">
          <span className="bg-foreground text-background inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
            <Gem className="size-3.5" />
            Beta &middot; Running on a Test Blockchain
          </span>
          <h1 className="max-w-3xl text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-6xl sm:leading-[1.02] lg:text-7xl">
            Trade real collectibles.
            <br />
            <span className="text-muted-foreground">Protected, verified, real.</span>
          </h1>
          <p className="text-muted-foreground max-w-xl text-base text-balance sm:text-lg">
            List PSA, BGS, and CGC certified trading cards. Every sale is
            protected, verified at our warehouse, and backed by a real
            digital certificate on the blockchain.
          </p>
          <div className="flex w-full flex-col items-center gap-2.5 pt-2 sm:w-auto sm:items-start">
            <LandingCta authenticated={authenticated} className="w-full px-8 sm:w-auto" />
            {!authenticated && (
              <span className="text-muted-foreground text-xs">
                No wallet needed to start — one is created for you automatically.
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-20">
        <div className="mb-8 flex flex-col gap-3 sm:mb-10">
          <span className="bg-foreground text-background w-fit rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
            Why Proof
          </span>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Built so nobody has to just take your word for it.
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-card flex flex-col gap-3 rounded-xl border p-5 transition-shadow sm:hover:shadow-md"
            >
              <div className="bg-foreground text-background flex size-10 items-center justify-center rounded-lg">
                <f.icon className="size-5" />
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="text-muted-foreground text-sm">{f.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-y bg-[color-mix(in_oklch,var(--muted)_40%,transparent)]">
        <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-20">
          <div className="mb-8 flex flex-col gap-3 sm:mb-10">
            <span className="bg-foreground text-background w-fit rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
              How it works
            </span>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">From sign-in to sold, in four steps.</h2>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-4">
            {STEPS.map((step, i) => (
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
          {authenticated ? "Welcome back." : "Ready to try it?"}
        </h2>
        <p className="text-muted-foreground max-w-md text-sm text-balance">
          {authenticated
            ? "Pick up where you left off — browse, list, or check on your portfolio."
            : "Sign in and you're a verified collector with a real wallet in seconds — browse, list, or buy your first certified item today."}
        </p>
        <LandingCta authenticated={authenticated} className="w-full max-w-xs px-8 sm:w-auto" />
        {!authenticated && (
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <BadgeCheck className="size-3.5" />
            Free to sign in — you only pay when you list or buy.
          </span>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}
