import Link from "next/link";
import {
  ArrowLeftRight,
  ArrowRight,
  BadgeCheck,
  BellRing,
  Camera,
  Gavel,
  HandCoins,
  PackageCheck,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Tag,
  Vault,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { CardGuide } from "@/components/guide/card-guide";
import { Button } from "@/components/ui/button";
import { SELF_MINT_FEE_THB, SELLER_SHIPPING_COST_THB, THB_PER_SOL } from "@/lib/pricing";
import { formatThb } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import type { Translate, TranslateVars } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

// Titles and bodies are English t() keys; {placeholders} are filled from vars.
interface Step {
  icon: LucideIcon;
  title: string;
  body: string;
  vars?: TranslateVars;
}

const BUY_STEPS: Step[] = [
  {
    icon: Wallet,
    title: "Top up your wallet",
    body: "Every account comes with a Solana wallet. On Portfolio, choose Deposit to add test SOL (devnet). Prices are in THB and convert at {rate} THB per SOL.",
    vars: { rate: THB_PER_SOL.toLocaleString() },
  },
  {
    icon: Search,
    title: "Find a card",
    body: "Browse the Marketplace, or check the Leaderboard for the biggest gainers, losers and new drops. Filter by grading company, grade, Black Label and price. The Compare Prices table puts several cards side by side.",
  },
  {
    icon: Sparkles,
    title: "Check the price",
    body: "Each item page shows Price Insights and a comparison with CardMart's median sale, other listings of the same card, and eBay, TCGplayer, Beckett and PriceCharting.",
  },
  {
    icon: ShieldCheck,
    title: "Buy with escrow",
    body: "Your payment is locked in an on-chain escrow, not paid straight to the seller. It's released only after our warehouse inspects the card and confirms it matches its certificate. Otherwise you're refunded.",
  },
  {
    icon: Vault,
    title: "Ship it or keep it in the vault",
    body: "Have the card shipped to you, or keep it in our vault. Vaulted cards can be resold, auctioned or swapped instantly with no shipping, and redeemed to your door any time.",
  },
];

const SELL_STEPS: Step[] = [
  {
    icon: Camera,
    title: "List with Instant Verify",
    body: "Open Listing and follow the live-camera checklist (front, back, label, corners). Type a PSA cert number and the card details fill in automatically. Listing costs a flat {fee}.",
    vars: { fee: formatThb(SELF_MINT_FEE_THB) },
  },
  {
    icon: Sparkles,
    title: "Get a digital twin",
    body: "Each card is registered as a 1-of-1 token on Solana. Sign once to let the platform transfer it to the buyer when it sells.",
  },
  {
    icon: Tag,
    title: "Price it, or auction it",
    body: "Set a fixed price and change it any time, or start an auction (scheduled up to 30 days ahead, anti-sniping included). Buyers can also send you offers.",
  },
  {
    icon: PackageCheck,
    title: "Ship to the warehouse when it sells",
    body: "When a buyer pays, send the card to our warehouse ({shipping} shipping). Once it passes inspection, the escrow pays you. Cards already in the vault sell instantly.",
    vars: { shipping: formatThb(SELLER_SHIPPING_COST_THB) },
  },
  {
    icon: BadgeCheck,
    title: "Build trust",
    body: "Verify your identity on Portfolio to get an ID-verified badge. Every completed sale can earn a buyer review, and your rating shows on your store and listings.",
  },
];

const MORE: { icon: LucideIcon; title: string; body: string; href: string; cta: string }[] = [
  {
    icon: HandCoins,
    title: "Make an offer",
    body: "Not happy with the asking price? Offer your own. If the seller accepts, you check out at your price.",
    href: "/marketplace",
    cta: "Browse listings",
  },
  {
    icon: Gavel,
    title: "Auctions",
    body: "Your bid is locked in escrow when you place it and returned automatically if you're outbid, so every winning bid is real money. Each new bid must beat the last by the bid step the seller set, shown on the auction, and a bid in the last 5 minutes adds 5 more.",
    href: "/auctions",
    cta: "See auctions",
  },
  {
    icon: ArrowLeftRight,
    title: "Swap cards",
    body: "Trade a vaulted card for someone else's vaulted card, with cash on top either way. Cash waits in escrow until the swap completes.",
    href: "/portfolio?tab=trades",
    cta: "My trades",
  },
  {
    icon: BellRing,
    title: "Card alerts",
    body: "Looking for a specific card? Set an alert by name, grade and maximum price, optionally for trusted sellers only, and get notified when one is listed.",
    href: "/portfolio?tab=alerts",
    cta: "My alerts",
  },
];

/**
 * The card after the last step: what to do next, with its button. It sits in
 * the steps' grid so it fills the free slot beside them instead of hanging
 * below. Also the last box of the Card guide.
 */
function NextStep({ title, body, href, cta, t }: { title: string; body: string; href: string; cta: string; t: Translate }) {
  return (
    <div className="bg-card flex flex-col justify-between gap-4 rounded-xl border p-4">
      <div className="flex flex-col gap-1">
        <span className="font-semibold">{t(title)}</span>
        <p className="text-muted-foreground text-sm">{t(body)}</p>
      </div>
      <Button asChild className="w-fit">
        <Link href={href}>
          {t(cta)} <ArrowRight />
        </Link>
      </Button>
    </div>
  );
}

/**
 * One path (Buy or Sell) as a numbered timeline inside a card: a connecting
 * line threads the step numbers so the journey reads top to bottom at a
 * glance, and the call to action is pinned to the bottom so the two cards
 * line up side by side. Icons sit next to each step title, not in a wall of
 * equal grey boxes.
 */
function Journey({
  id,
  icon: Icon,
  heading,
  accent,
  steps,
  cta,
  t,
}: {
  id: string;
  icon: LucideIcon;
  heading: string;
  /** The tint behind the header icon — the one spot of colour per card. */
  accent: string;
  steps: Step[];
  cta: { body: string; href: string; label: string };
  t: Translate;
}) {
  return (
    <section id={id} className="scroll-mt-20 h-full">
      <div className="bg-card flex h-full flex-col gap-5 rounded-2xl border p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", accent)}>
            <Icon className="size-5" />
          </span>
          <h2 className="text-lg font-semibold">{t(heading)}</h2>
        </div>

        <ol className="relative flex flex-col">
          {steps.map((step, i) => {
            const StepIcon = step.icon;
            const last = i === steps.length - 1;
            return (
              <li key={step.title} className="relative flex gap-4 pb-5 last:pb-0">
                {/* The thread between this number and the next. */}
                {!last && <span aria-hidden className="bg-border absolute top-9 bottom-0 left-4 w-px -translate-x-1/2" />}
                <span className="bg-foreground text-background z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                  {i + 1}
                </span>
                <div className="flex min-w-0 flex-col gap-1 pt-1">
                  <span className="flex items-center gap-2 font-semibold">
                    <StepIcon className="text-muted-foreground size-4 shrink-0" />
                    {t(step.title)}
                  </span>
                  <p className="text-muted-foreground text-sm">{t(step.body, step.vars)}</p>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-auto flex flex-col items-start gap-3 border-t pt-4">
          <p className="text-muted-foreground text-sm">{t(cta.body)}</p>
          <Button asChild className="w-fit">
            <Link href={cta.href}>
              {t(cta.label)} <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

export default async function GuidePage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const [{ welcome }, t] = await Promise.all([searchParams, getT()]);

  return (
    <div className="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
      {welcome && (
        <div className="bg-foreground text-background mb-8 rounded-xl p-5">
          <p className="text-lg font-semibold">{t("Welcome to CardMart")}</p>
          <p className="text-background/80 mt-1 text-sm">
            {t("Your profile is set up. Here's a two-minute tour of how buying and selling works. You can come back to it any time from the menu under your avatar.")}
          </p>
        </div>
      )}

      <div className="mb-6 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t("Getting started")}</h1>
        <p className="text-muted-foreground text-sm">
          {t("New to collecting graded cards? Pick a path below and follow the steps.")}
        </p>
      </div>

      {/* Buy and Sell side by side as two timelines, so both paths are visible
          at a glance instead of a long scroll of look-alike cards. Each keeps
          its own #anchor. */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        <Journey
          id="buy"
          icon={ShoppingBag}
          heading="I want to buy"
          accent="bg-foreground text-background"
          steps={BUY_STEPS}
          cta={{
            body: "Browse graded cards from verified sellers. Every payment is held in escrow until the card checks out.",
            href: "/marketplace",
            label: "Start browsing",
          }}
          t={t}
        />
        <Journey
          id="sell"
          icon={Store}
          heading="I want to sell"
          accent="bg-primary text-primary-foreground"
          steps={SELL_STEPS}
          cta={{
            body: "List a card in a few minutes with Instant Verify, then set a price or start an auction.",
            href: "/marketplace/sell",
            label: "List your first card",
          }}
          t={t}
        />
      </div>

      <section id="cards" className="mt-12 scroll-mt-20">
        <h2 className="mb-4 text-lg font-semibold">{t("Card guide")}</h2>
        <CardGuide
          t={t}
          next={
            <NextStep
              title="See them on the Market"
              body="Every tag here appears on the cards for sale. Filter by game, rarity, grade and language."
              href="/marketplace"
              cta="Start browsing"
              t={t}
            />
          }
        />
      </section>

      <h2 className="mt-12 mb-4 text-lg font-semibold">{t("More ways to trade")}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {MORE.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.title} className="bg-card flex flex-col gap-3 rounded-xl border p-4">
              <span className="bg-muted text-foreground flex size-9 items-center justify-center rounded-lg">
                <Icon className="size-5" />
              </span>
              <span className="font-semibold">{t(m.title)}</span>
              <p className="text-muted-foreground flex-1 text-sm">{t(m.body)}</p>
              <Link href={m.href} className="text-foreground inline-flex items-center gap-1 text-sm font-medium hover:underline">
                {t(m.cta)} <ArrowRight className="size-3.5" />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
