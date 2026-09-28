import Link from "next/link";
import {
  ArrowLeftRight,
  BadgeCheck,
  BellRing,
  Camera,
  Gavel,
  HandCoins,
  PackageCheck,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  Vault,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FULL_SERVICE_PACKAGE_PRICE_THB, SELF_MINT_FEE_THB, SELLER_SHIPPING_COST_THB, THB_PER_SOL } from "@/lib/pricing";
import { formatThb } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import type { Translate, TranslateVars } from "@/lib/i18n/translate";

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
    title: "Or send a raw card for grading",
    body: "Choose “Get it graded first” on Listing. We ship the card to PSA, BGS or CGC, pay their fee and mint it when it comes back — {price} all-in. Track it from the Grading tab on Portfolio.",
    vars: { price: formatThb(FULL_SERVICE_PACKAGE_PRICE_THB) },
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
    body: "Your bid is locked in escrow when you place it and returned automatically if you're outbid, so every winning bid is real money. Minimum bids go up in 50 THB steps, and a bid in the last 5 minutes adds 5 more.",
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

function StepList({ steps, t }: { steps: Step[]; t: Translate }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step, i) => {
        const Icon = step.icon;
        return (
          <li key={step.title} className="bg-card flex gap-4 rounded-xl border p-4">
            <div className="flex shrink-0 flex-col items-center gap-2">
              <span className="bg-foreground text-background flex size-8 items-center justify-center rounded-full text-sm font-bold">
                {i + 1}
              </span>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="flex items-center gap-2 font-semibold">
                <Icon className="text-muted-foreground size-4" />
                {t(step.title)}
              </span>
              <p className="text-muted-foreground text-sm">{t(step.body, step.vars)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default async function GuidePage({ searchParams }: { searchParams: Promise<{ welcome?: string; tab?: string }> }) {
  const [{ welcome, tab }, t] = await Promise.all([searchParams, getT()]);

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
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

      <Tabs defaultValue={tab === "sell" ? "sell" : "buy"}>
        <TabsList>
          <TabsTrigger value="buy">{t("I want to buy")}</TabsTrigger>
          <TabsTrigger value="sell">{t("I want to sell")}</TabsTrigger>
        </TabsList>
        <TabsContent value="buy" className="flex flex-col gap-4 pt-4">
          <StepList steps={BUY_STEPS} t={t} />
          <Button asChild className="w-fit">
            <Link href="/marketplace">{t("Start browsing")}</Link>
          </Button>
        </TabsContent>
        <TabsContent value="sell" className="flex flex-col gap-4 pt-4">
          <StepList steps={SELL_STEPS} t={t} />
          <Button asChild className="w-fit">
            <Link href="/listing">{t("List your first card")}</Link>
          </Button>
        </TabsContent>
      </Tabs>

      <h2 className="mt-12 mb-4 text-lg font-semibold">{t("More ways to trade")}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {MORE.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.title} className="bg-card flex flex-col gap-2 rounded-xl border p-4">
              <span className="flex items-center gap-2 font-semibold">
                <Icon className="text-muted-foreground size-4" />
                {t(m.title)}
              </span>
              <p className="text-muted-foreground flex-1 text-sm">{t(m.body)}</p>
              <Link href={m.href} className="text-sm font-medium underline underline-offset-2">
                {t(m.cta)}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
