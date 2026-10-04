"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { AssetCategory, GradingCompany } from "@prisma/client";

import { CardArt } from "@/components/asset/card-art";
import { useLanguage } from "@/components/landing/language-provider";
import { formatGrade, formatThb } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface SimilarListing {
  id: string;
  name: string;
  subtitle: string;
  priceThb: number;
  imageUrl: string | null;
  themeIndex: number;
  category: AssetCategory;
  gradingCompany: GradingCompany;
  grade: number | null;
  isBlackLabel: boolean;
  sellerName: string;
  // A fair price for this card in this grade (eBay median ask, else CardMart
  // median sale), or null when there's no basis for one.
  estimateThb: number | null;
  // The listing the page is about.
  viewing?: boolean;
}

// Within this much of the estimate, a listing is priced "Fair".
const FAIR_BAND_PCT = 5;

function dealPct(l: SimilarListing) {
  return l.estimateThb ? ((l.priceThb - l.estimateThb) / l.estimateThb) * 100 : null;
}

/**
 * The same card from every seller and in every grade, as a grid of cards like
 * a marketplace's: price against an estimate as a badge, the estimate on the
 * image, grade and seller underneath. "Best deals" sorts by how far under the
 * estimate each one is; "Cheapest" by price. The listing being viewed is in
 * the grid too, marked, so it's easy to see where it stands.
 */
export function SimilarListings({ listings }: { listings: SimilarListing[] }) {
  const { tr: t } = useLanguage();
  const [sort, setSort] = useState<"deals" | "cheapest">("deals");

  const sorted = [...listings].sort((a, b) => {
    if (sort === "cheapest") return a.priceThb - b.priceThb;
    const da = dealPct(a);
    const db = dealPct(b);
    // Listings without an estimate go last, cheapest first among them.
    if (da == null || db == null) return Number(da == null) - Number(db == null) || a.priceThb - b.priceThb;
    return da - db;
  });

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("Similar Listings")}</h2>
          <div className="bg-secondary/60 flex gap-1 rounded-xl border p-1">
            {(
              [
                ["deals", t("Best Deals")],
                ["cheapest", t("Cheapest")],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSort(key)}
                className={cn(
                  "rounded-lg px-3 py-1 text-sm font-semibold transition-colors",
                  sort === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <span className="text-muted-foreground text-sm">
          {t(listings.length === 1 ? "{count} listing" : "{count} listings", { count: listings.length })}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
        {sorted.map((l) => (
          <ListingCard key={l.id} listing={l} />
        ))}
      </div>
    </section>
  );
}

function ListingCard({ listing: l }: { listing: SimilarListing }) {
  const { tr: t } = useLanguage();
  const pct = dealPct(l);
  const grade = l.gradingCompany === "RAW" ? t("Raw") : `${l.gradingCompany} ${formatGrade(l.grade)}${l.isBlackLabel ? " BL" : ""}`;

  return (
    <Link
      href={`/item/${l.id}`}
      aria-current={l.viewing ? "page" : undefined}
      className={cn(
        "group bg-card focus-visible:ring-ring relative flex flex-col rounded-2xl border outline-none transition-colors focus-visible:ring-2",
        l.viewing ? "border-foreground/50" : "hover:border-foreground/30",
      )}
    >
      {l.viewing && (
        <span className="bg-background text-foreground absolute -top-2.5 left-3 z-10 rounded-md border px-2 py-0.5 text-[11px] font-semibold">
          {t("Viewing")}
        </span>
      )}

      <div className="card-stage relative aspect-[4/5] overflow-hidden rounded-t-2xl">
        {l.imageUrl ? (
          <Image
            src={l.imageUrl}
            alt={l.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-contain p-4 drop-shadow-[0_12px_24px_rgba(0,0,0,0.6)] transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <CardArt
              themeIndex={l.themeIndex}
              category={l.category}
              gradingCompany={l.gradingCompany}
              grade={l.grade}
              isBlackLabel={l.isBlackLabel}
              bordered={false}
              className="h-full w-auto rounded-lg"
            />
          </div>
        )}

        {pct != null && (
          <span
            className={cn(
              "absolute top-2.5 right-2.5 rounded-md bg-black/75 px-2 py-1 text-xs leading-none font-bold tabular-nums backdrop-blur-sm",
              Math.abs(pct) < FAIR_BAND_PCT ? "text-compare" : pct < 0 ? "text-success" : "text-foreground",
            )}
          >
            {Math.abs(pct) < FAIR_BAND_PCT ? t("Fair") : `${pct < 0 ? "▼" : "▲"} ${Math.abs(Math.round(pct))}%`}
          </span>
        )}
        {l.estimateThb != null && (
          <span className="absolute right-2.5 bottom-2.5 rounded-md bg-black/75 px-2 py-1 text-xs leading-none font-semibold tabular-nums backdrop-blur-sm">
            {t("Est. {price}", { price: formatThb(l.estimateThb) })}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1 p-3.5">
        <span className="truncate text-sm font-semibold">{l.name}</span>
        <span className="text-muted-foreground truncate text-xs">{l.subtitle}</span>
        <span className="mt-1 text-lg font-bold tabular-nums">{formatThb(l.priceThb)}</span>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="text-muted-foreground truncate text-xs">{l.sellerName}</span>
          <span className="shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold">{grade}</span>
        </div>
      </div>
    </Link>
  );
}
