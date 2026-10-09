import Link from "next/link";
import { ChevronDown } from "lucide-react";

import { formatThb } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import type { TranslateVars } from "@/lib/i18n/translate";
import {
  AGENT_TASK_FEE_THB,
  AGENT_TASK_MAX_REVIEWS,
  BUYER_FEE_PERCENT,
  FULL_SERVICE_PACKAGE_PRICE_THB,
  SELF_MINT_FEE_THB,
  SELLER_SHIPPING_COST_THB,
  THB_PER_SOL,
  THB_PER_USD,
} from "@/lib/pricing";
import { DISPUTE_WINDOW_DAYS, SELLER_SHIP_DAYS } from "@/lib/shipping";

export const metadata = {
  title: "FAQ — CardMart",
};

// Questions and answers are English t() keys; {placeholders} are filled from vars.
interface Question {
  q: string;
  a: string;
  vars?: TranslateVars;
}

const SECTIONS: { title: string; questions: Question[] }[] = [
  {
    title: "Prices and data",
    questions: [
      {
        q: "Where does the market price come from?",
        a: "From real listings and sales only. First choice is the median asking price of live eBay listings for the exact same card in the exact same grade. If eBay has no match, it's the median of completed CardMart sales in that grade. If neither exists, no market price is shown. Ungraded cards work the same way, priced from eBay listings of the ungraded card. A price never comes from a different grade.",
      },
      {
        q: "Why eBay asking prices and not sold prices?",
        a: "eBay only shares sold-price data with approved partners, so the price we can fetch is what sellers are asking right now. It's always labeled as an asking price. To see what the card actually sold for, use the \"eBay sold listings\" link on the item page, which opens eBay's own sold search.",
      },
      {
        q: "How do you know an eBay listing is the same card?",
        a: "A listing only counts if its title has the card's name, set and card number, the same grading company and grade (or no grader for a raw card), and the same language. Japanese and English prints are kept apart, and Black Label is matched separately. Lots, proxies, reprints and customs are thrown out. We'd rather show a few real matches than many look-alikes.",
      },
      {
        q: "Why does my card have no market price?",
        a: "Nobody is selling that exact card in that grade on eBay right now, and it hasn't sold on CardMart in that grade yet. Rare cards and unusual grades often have no match. The price shows up once there's real data.",
      },
      {
        q: "Why do some prices have \"≈\" in front?",
        a: "eBay and TCGplayer prices are in US dollars. We convert them at a fixed rate of about {rate} THB per USD so everything sits on one baht scale. It's only for comparing and is never used for payments.",
        vars: { rate: THB_PER_USD },
      },
      {
        q: "What does \"a rough guide\" mean next to a price comparison?",
        a: "The comparison rests on fewer than 3 prices. One or two listings can be far off the real market, so take it as a hint, not a verdict.",
      },
      {
        q: "What's the CardMart median sale?",
        a: "The middle price of completed CardMart sales of the exact same card and grade over the last 90 days. We use the median rather than the average so one unusually high or low sale can't drag it.",
      },
      {
        q: "What is the TCGplayer price?",
        a: "TCGplayer's market price for the ungraded card, shown next to eBay's ungraded price as a second opinion. TCGplayer only covers trading card games.",
      },
      {
        q: "What does the Market Price History chart show?",
        a: "The market price saved once a day: eBay's median asking price for that card and grade, or CardMart sales when eBay has none. It never shows the seller's own asking price, so a seller can't move the chart by changing their price.",
      },
      {
        q: "How fresh are the prices?",
        a: "eBay prices are fetched live and reused for up to 10 minutes. Every card for sale also gets its market price saved once a day for the history chart.",
      },
      {
        q: "How are Leaderboard gainers and losers worked out?",
        a: "By how much each listing's asking price changed over 24 hours, 7 days or 30 days, from the listing's own price history. A listing with no earlier price in that window shows no change instead of 0%.",
      },
    ],
  },
  {
    title: "Buying",
    questions: [
      {
        q: "Is this real money?",
        a: "Not yet. CardMart runs on Solana devnet for now, so payments use test SOL, which has no real value. We will move to real payments on Solana mainnet. Until then, you can add test SOL from Portfolio with Deposit.",
      },
      {
        q: "How are THB prices paid in SOL?",
        a: "Prices are set in THB and converted at a fixed {rate} THB per SOL when you pay.",
        vars: { rate: THB_PER_SOL.toLocaleString() },
      },
      {
        q: "What do I pay on top of the price?",
        a: "A {pct}% buyer protection fee, which pays for escrow and the warehouse inspection. It's refunded together with your payment if the sale is cancelled.",
        vars: { pct: BUYER_FEE_PERCENT },
      },
      {
        q: "Where does my money go when I buy?",
        a: "Into an on-chain escrow, not straight to the seller. Our warehouse checks the card against its grading certificate. If it matches, the seller is paid. If it doesn't, the sale is cancelled and you get your money back.",
      },
      {
        q: "What if the seller never ships?",
        a: "Sellers have {days} days to send the card to our warehouse with a tracking number. If they don't, the sale is cancelled and you're refunded.",
        vars: { days: SELLER_SHIP_DAYS },
      },
      {
        q: "Something's wrong with my card after it arrived. What can I do?",
        a: "Open the item page and choose \"Report a problem\" within {days} days of the purchase completing. Our team reviews it and can refund you.",
        vars: { days: DISPUTE_WINDOW_DAYS },
      },
      {
        q: "Should I ship my card or keep it in the vault?",
        a: "Shipping sends the physical card to you. The vault keeps it safe with us, and a vaulted card can be resold, auctioned or swapped instantly with no shipping. You can redeem a vaulted card to your door any time.",
      },
    ],
  },
  {
    title: "Selling",
    questions: [
      {
        q: "What does it cost to sell?",
        a: "Listing a graded card with Instant Verify costs {fee}. When it sells, you send it to our warehouse, which costs {shipping}. If your card isn't graded yet, the full-service package (shipping to the grader, grading and listing) is {package}.",
        vars: {
          fee: formatThb(SELF_MINT_FEE_THB),
          shipping: formatThb(SELLER_SHIPPING_COST_THB),
          package: formatThb(FULL_SERVICE_PACKAGE_PRICE_THB),
        },
      },
      {
        q: "When do I get paid?",
        a: "When the card passes inspection at our warehouse, the escrow releases the buyer's payment to you. Cards already in the vault are inspected, so they sell instantly.",
      },
      {
        q: "Can I change my price?",
        a: "Yes, any time from Portfolio with Edit Price. Buyers watching the card are told when the price drops.",
      },
      {
        q: "Can I take my listing down?",
        a: "Yes, for a card you still hold: choose Delist on its card in Portfolio. An auction can be cancelled only while it has no bids. A card that's in the vault can be repriced with Relist but can't be taken off sale yet. A card in an active sale can't be delisted, because the buyer's money is already in escrow.",
      },
      {
        q: "Why does my listing say \"% above market\"?",
        a: "Each listing is compared with the market price for the exact card and grade, so buyers can see how far above or below market it is. It's information, not a judgment. A rare card can be worth more than its few comparable listings.",
      },
    ],
  },
  {
    title: "Auctions",
    questions: [
      {
        q: "What happens to my money when I bid?",
        a: "Your bid is locked in escrow when you place it and returned automatically if someone outbids you, so every winning bid can be paid.",
      },
      {
        q: "Why did the auction end time move?",
        a: "A bid in the last 5 minutes adds 5 more minutes, so nobody can win by bidding at the last second.",
      },
      {
        q: "I won an auction. What now?",
        a: "Choose whether to ship the card or keep it in the vault within 48 hours. If you don't choose, it goes to the vault for you, and you can redeem it later.",
      },
    ],
  },
  {
    title: "Vault and digital twins",
    questions: [
      {
        q: "What is a digital twin?",
        a: "A 1-of-1 token on Solana that stands for one physical card. Owning the token means owning the card. When the card sells, the token moves to the buyer.",
      },
      {
        q: "What happens when I redeem a vaulted card?",
        a: "The warehouse ships the physical card to you and the token is burned. It's final: the card can't be listed, auctioned or swapped on CardMart afterwards.",
      },
    ],
  },
  {
    title: "Buying agent",
    questions: [
      {
        q: "What does the buying agent do?",
        a: "You tell it which card you want and your maximum price, and it checks listings and buys a match for you from your agent wallet.",
      },
      {
        q: "What does it cost?",
        a: "{fee} per task, which covers the AI that reviews listings. One task reviews up to {max} listings.",
        vars: { fee: formatThb(AGENT_TASK_FEE_THB), max: AGENT_TASK_MAX_REVIEWS },
      },
    ],
  },
];

export default async function FaqPage() {
  const t = await getT();

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t("Questions & answers")}</h1>
        <p className="text-muted-foreground text-sm">
          {t("How prices are worked out, where your money goes, and what happens at each step.")}{" "}
          <Link href="/guide" className="text-foreground underline underline-offset-2">
            {t("New here? Start with the guide.")}
          </Link>
        </p>
      </div>

      <div className="flex flex-col gap-10">
        {SECTIONS.map((section) => (
          <section key={section.title} className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">{t(section.title)}</h2>
            <div className="bg-card divide-y rounded-xl border">
              {section.questions.map((item) => (
                <details key={item.q} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
                    {t(item.q)}
                    <ChevronDown className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="text-muted-foreground px-4 pb-4 text-sm leading-relaxed">{t(item.a, item.vars)}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
