import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Camera,
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
    title: "Escrow-protected sales",
    description: "Every sale locks the buyer's payment until the item clears warehouse inspection.",
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
    description: "Sign in with Google or email and Privy creates a real Solana wallet for you — no seed phrases.",
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
    description: "Set a price. Your digital twin goes live on the marketplace, backed by the real item.",
  },
  {
    title: "Sell with escrow protection",
    description: "Payment locks in escrow, the item is inspected, then it ships to the buyer or joins the vault.",
  },
];

// One CTA, two states: a real Privy login for a guest, a plain link onward
// for someone already signed in — "/" never redirects them away, it just
// swaps what the button does.
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

      <div className="relative overflow-hidden border-b bg-[radial-gradient(120%_140%_at_10%_-10%,rgba(99,102,241,0.18),transparent_60%)]">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-4 py-16 sm:px-6 sm:py-24">
          <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl">
            Trade real collectibles, secured by physical escrow &amp; digital certificates.
          </h1>
          <p className="text-muted-foreground max-w-xl text-base sm:text-lg">
            List PSA, BGS, and CGC certified trading cards. Every sale is
            protected by escrow, verified at our warehouse, and mirrored by a
            real digital twin on Solana.
          </p>
          <div className="flex flex-col items-start gap-2 pt-2">
            <LandingCta authenticated={authenticated} className="w-auto px-8" />
            {!authenticated && (
              <span className="text-muted-foreground text-xs">
                No wallet needed to start — one is created for you automatically.
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="mb-10 flex flex-col gap-2">
          <span className="text-primary text-sm font-semibold uppercase tracking-wide">Why Proof</span>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Built so nobody has to just take your word for it.
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-card flex flex-col gap-3 rounded-xl border p-5">
              <f.icon className="text-primary size-6" />
              <h3 className="font-semibold">{f.title}</h3>
              <p className="text-muted-foreground text-sm">{f.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-y bg-[color-mix(in_oklch,var(--muted)_40%,transparent)]">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="mb-10 flex flex-col gap-2">
            <span className="text-primary text-sm font-semibold uppercase tracking-wide">How it works</span>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">From sign-in to sold, in four steps.</h2>
          </div>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <div key={step.title} className="flex flex-col gap-2">
                <span className="text-primary text-sm font-semibold">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="text-muted-foreground text-sm">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6 sm:py-24">
        <Sparkles className="text-primary size-8" />
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {authenticated ? "Welcome back." : "Ready to try it?"}
        </h2>
        <p className="text-muted-foreground max-w-md text-sm">
          {authenticated
            ? "Pick up where you left off — browse, list, or check on your portfolio."
            : "Sign in and you're a verified collector with a real wallet in seconds — browse, list, or buy your first certified item today."}
        </p>
        <LandingCta authenticated={authenticated} className="w-auto px-8" />
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
