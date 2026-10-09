"use client";

import { ArrowDownRight, ArrowUpRight, ExternalLink, Loader2 } from "lucide-react";

import type { EbayPriceQuote } from "@/lib/ebay";
import { formatThb, formatUsd } from "@/lib/format";
import { THB_PER_USD } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/landing/language-provider";

// Fewer prices than this behind a verdict, and the panel says it's a rough guide.
const MIN_RELIABLE_PRICES = 3;

const usdToThb = (usd: number) => Math.round(usd * THB_PER_USD);

function searchUrl(base: string, param: string, query: string, extra: Record<string, string> = {}) {
  return `${base}?${new URLSearchParams({ [param]: query, ...extra }).toString()}`;
}

/** A round axis maximum a little above the largest value, so ticks land on readable numbers. */
function niceMax(value: number) {
  const padded = value * 1.08;
  const step = 10 ** Math.floor(Math.log10(padded));
  return Math.ceil(padded / (step / 2)) * (step / 2);
}

interface Lane {
  key: string;
  name: string;
  source: Source;
  kind: "Asking" | "Sold" | "Market";
  pointThb: number | null;
  rangeThb?: [number, number];
  price: string | null;
  approx?: string;
  note: string;
  href?: string;
  highlight?: boolean;
  loading?: boolean;
}

type Source = "cardmart" | "ebay" | "tcgplayer" | "pricecharting" | "beckett";

// eBay's four-color lowercase wordmark, drawn as text so it stays crisp at any size.
const EBAY_LETTERS = [
  ["e", "#E53238"],
  ["b", "#0064D2"],
  ["a", "#F5AF02"],
  ["y", "#86B817"],
] as const;

/** A price source's logo on a white tile, so each row is recognizable at a glance. */
function SourceMark({ source, size = "md" }: { source: Source; size?: "sm" | "md" }) {
  const small = size === "sm";
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden bg-white",
        small ? "size-5 rounded-full" : "size-8 rounded-lg",
      )}
    >
      {source === "cardmart" ? (
        // The star sits in a lot of padding; scale it up to fill the tile.
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/cardmart-logo.png" alt="" className="size-full scale-[1.7] object-contain" />
      ) : source === "ebay" ? (
        <span className={cn("leading-none font-bold tracking-[-0.06em]", small ? "text-[8px]" : "text-[11px]")}>
          {EBAY_LETTERS.map(([letter, color]) => (
            <span key={letter} style={{ color }}>
              {letter}
            </span>
          ))}
        </span>
      ) : source === "beckett" ? (
        <span className={cn("font-black text-neutral-900", small ? "text-[9px]" : "text-xs")}>B</span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/logos/${source}.png`} alt="" className={small ? "size-3.5" : "size-5"} />
      )}
    </span>
  );
}

/**
 * This listing against every price source for the grade picked above it, on
 * one baht scale: CardMart asks and sales in that grade, eBay's exact-match
 * asking price and, for raw cards, TCGplayer. Picking another grade answers
 * "what would a PSA 10 of this card cost me instead?" in the same panel.
 */
export function GradeCompare({
  tierName,
  isOwnGrade,
  listingThb,
  listingGradeName,
  asks,
  salePrices,
  ebay,
  tcg,
  query,
}: {
  tierName: string;
  isOwnGrade: boolean;
  listingThb: number | null;
  listingGradeName: string;
  // Other live CardMart listings of this card in the picked grade.
  asks: number[];
  // Completed CardMart sales of this card in the picked grade.
  salePrices: number[];
  // undefined while it's still loading.
  ebay: EbayPriceQuote | null | undefined;
  tcg: { marketPriceUsd: number; matchedName: string } | null;
  query: string;
}) {
  const { tr: t } = useLanguage();

  const lowAsk = asks.length ? Math.min(...asks) : null;
  const highAsk = asks.length ? Math.max(...asks) : null;
  const askRange = lowAsk != null && highAsk != null && highAsk !== lowAsk ? ([lowAsk, highAsk] as [number, number]) : undefined;
  const sorted = [...salePrices].sort((a, b) => a - b);
  const medianSale = sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : null;

  const lanes: Lane[] = [
    {
      key: "listing",
      name: t("This listing"),
      source: "cardmart",
      kind: "Asking",
      pointThb: listingThb,
      price: listingThb != null ? formatThb(listingThb) : null,
      note: listingThb != null ? listingGradeName : t("Not listed for sale right now"),
      highlight: true,
    },
    {
      key: "same",
      name: t("CardMart — {grade}", { grade: tierName }),
      source: "cardmart",
      kind: "Asking",
      pointThb: askRange ? null : lowAsk,
      rangeThb: askRange,
      price: lowAsk == null ? null : askRange ? `${formatThb(askRange[0])} – ${formatThb(askRange[1])}` : formatThb(lowAsk),
      note:
        asks.length > 0
          ? t(asks.length === 1 ? "{count} live listing" : "{count} live listings", { count: asks.length })
          : t("No live listings"),
    },
    {
      key: "sold",
      name: t("CardMart — median sale"),
      source: "cardmart",
      kind: "Sold",
      pointThb: medianSale,
      price: medianSale != null ? formatThb(medianSale) : null,
      note:
        sorted.length > 0
          ? t(sorted.length === 1 ? "{count} sale" : "{count} sales", {
              count: sorted.length,
            })
          : t("No completed sales yet"),
    },
    {
      key: "ebay",
      name: "eBay",
      source: "ebay",
      kind: "Asking",
      pointThb: ebay ? usdToThb(ebay.medianPriceUsd) : null,
      rangeThb: ebay && ebay.itemCount > 1 ? [usdToThb(ebay.lowPriceUsd), usdToThb(ebay.highPriceUsd)] : undefined,
      price: ebay ? formatUsd(ebay.medianPriceUsd) : null,
      approx: ebay ? `≈ ${formatThb(usdToThb(ebay.medianPriceUsd))}` : undefined,
      note:
        ebay === undefined
          ? t("Checking eBay…")
          : ebay
            ? `${t(ebay.itemCount === 1 ? "Median of {count} active listing" : "Median of {count} active listings", { count: ebay.itemCount })} · ${formatUsd(ebay.lowPriceUsd)}–${formatUsd(ebay.highPriceUsd)}`
            : t("No exact match listed right now"),
      href: searchUrl("https://www.ebay.com/sch/i.html", "_nkw", query),
      loading: ebay === undefined,
    },
    ...(tcg
      ? [
          {
            key: "tcg",
            name: "TCGplayer",
            source: "tcgplayer",
            kind: "Market",
            pointThb: usdToThb(tcg.marketPriceUsd),
            price: formatUsd(tcg.marketPriceUsd),
            approx: `≈ ${formatThb(usdToThb(tcg.marketPriceUsd))}`,
            note: `${t("Ungraded (raw) card")} · ${tcg.matchedName}`,
            href: searchUrl("https://www.tcgplayer.com/search/all/product", "q", tcg.matchedName),
          } satisfies Lane,
        ]
      : []),
  ];

  const values = lanes.flatMap((l) => [l.pointThb, ...(l.rangeThb ?? [])]).filter((v): v is number => v != null && v > 0);
  const axisMax = values.length ? niceMax(Math.max(...values)) : 0;
  const pos = (v: number) => `${Math.min(100, (v / axisMax) * 100)}%`;
  const ticks = [0, axisMax / 2, axisMax];

  // Headline: this listing against the best reference for the picked grade.
  // count = how many prices it rests on, so a verdict from one listing says so.
  const reference = ebay
    ? { label: t("eBay median asking price"), thb: usdToThb(ebay.medianPriceUsd), count: ebay.itemCount }
    : medianSale != null
      ? { label: t("CardMart median sale"), thb: medianSale, count: sorted.length }
      : lowAsk != null
        ? { label: t("the cheapest CardMart listing"), thb: lowAsk, count: asks.length }
        : null;
  const diffPct = listingThb != null && reference ? ((listingThb - reference.thb) / reference.thb) * 100 : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-card overflow-hidden rounded-2xl border">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b p-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground text-xs">
              {isOwnGrade
                ? t("This listing")
                : t("This listing ({grade}) vs {other}", {
                    grade: listingGradeName,
                    other: tierName,
                  })}
            </span>
            <span className="text-2xl leading-none font-bold tabular-nums">
              {listingThb != null ? formatThb(listingThb) : "—"}
            </span>
          </div>
          {diffPct != null && reference && (
            <div className="flex items-center gap-2 text-sm">
              {Math.abs(diffPct) < 1 ? null : diffPct < 0 ? (
                <ArrowDownRight className={cn("size-4", isOwnGrade ? "text-success" : "text-compare")} />
              ) : (
                <ArrowUpRight className={cn("size-4", isOwnGrade ? "text-destructive" : "text-compare")} />
              )}
              <span>
                <span className={cn("font-semibold", !isOwnGrade && "text-compare")}>
                  {Math.abs(diffPct) < 1
                    ? t("About the same as")
                    : t(diffPct < 0 ? "{pct}% below" : "{pct}% above", {
                        pct: Math.abs(diffPct).toFixed(0),
                      })}
                </span>{" "}
                <span className="text-muted-foreground">
                  {isOwnGrade ? reference.label : `${reference.label}, ${tierName}`} ({formatThb(reference.thb)})
                </span>
                {reference.count < MIN_RELIABLE_PRICES && (
                  <span className="block text-right text-xs text-amber-400">
                    {t(reference.count === 1 ? "Based on only {count} price — a rough guide." : "Based on only {count} prices — a rough guide.", { count: reference.count })}
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        <ul className="divide-y">
          {lanes.map((lane) => {
            const hasData = lane.pointThb != null || lane.rangeThb != null;
            return (
              <li
                key={lane.key}
                className={cn(
                  "grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[auto_minmax(0,14rem)_1fr_7.5rem]",
                  lane.highlight && "bg-muted/40",
                )}
              >
                <SourceMark source={lane.source} />
                <div className="flex min-w-0 flex-col">
                  {lane.href ? (
                    <a
                      href={lane.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-fit items-center gap-1 text-sm font-medium hover:underline"
                    >
                      {lane.name} <ExternalLink className="size-3 shrink-0" />
                    </a>
                  ) : (
                    <span className="text-sm font-medium">{lane.name}</span>
                  )}
                  <span className="text-muted-foreground line-clamp-2 text-[11px]">
                    {t(lane.kind)} · {lane.note}
                  </span>
                </div>

                {/* Track: full width under the name on phones, its own column from sm up */}
                <div className="relative col-span-3 h-6 sm:col-span-1 sm:col-start-3 sm:row-start-1">
                  <div className="bg-border absolute inset-x-0 top-1/2 h-px" />
                  {listingThb != null && axisMax > 0 && !lane.highlight && (
                    <div
                      className="border-foreground/40 absolute inset-y-0 border-l border-dashed"
                      style={{ left: pos(listingThb) }}
                      aria-hidden
                    />
                  )}
                  {hasData && axisMax > 0 && (
                    <>
                      {lane.rangeThb && (
                        <div
                          className={cn(
                            "absolute top-1/2 h-2 -translate-y-1/2 rounded-full",
                            isOwnGrade ? "bg-foreground/15" : "bg-compare/30",
                          )}
                          style={{
                            left: pos(lane.rangeThb[0]),
                            width: `calc(${pos(lane.rangeThb[1])} - ${pos(lane.rangeThb[0])})`,
                          }}
                          title={`${formatThb(lane.rangeThb[0])} – ${formatThb(lane.rangeThb[1])}`}
                        />
                      )}
                      {lane.pointThb != null && (
                        <div
                          className={cn(
                            "ring-card absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2",
                            lane.highlight
                              ? "bg-foreground size-3.5"
                              : isOwnGrade
                                ? "bg-muted-foreground size-2.5"
                                : "bg-compare size-2.5",
                          )}
                          style={{ left: pos(lane.pointThb) }}
                          title={`${lane.name}: ${formatThb(lane.pointThb)}`}
                        />
                      )}
                    </>
                  )}
                </div>

                <div className="col-start-3 row-start-1 flex flex-col items-end text-right sm:col-start-4">
                  {lane.loading ? (
                    <Loader2 className="text-muted-foreground size-4 animate-spin" />
                  ) : lane.price ? (
                    <>
                      <span className="text-sm font-semibold tabular-nums">{lane.price}</span>
                      {lane.approx && <span className="text-muted-foreground text-[11px] tabular-nums">{lane.approx}</span>}
                    </>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {axisMax > 0 && (
          <div className="text-muted-foreground hidden grid-cols-[auto_minmax(0,14rem)_1fr_7.5rem] gap-x-3 border-t px-4 py-2 text-[10px] tabular-nums sm:grid">
            <span className="w-8" />
            <span />
            <div className="relative h-3">
              {ticks.map((v, i) => (
                <span
                  key={v}
                  className={cn("absolute", i === 0 ? "" : i === ticks.length - 1 ? "-translate-x-full" : "-translate-x-1/2")}
                  style={{ left: pos(v) }}
                >
                  {formatThb(v)}
                </span>
              ))}
            </div>
            <span />
          </div>
        )}
      </div>

      <CompareLinks query={query} />
    </div>
  );
}

/** Sources we can only search, not query, pre-filled for this card in the picked grade. */
function CompareLinks({ query }: { query: string }) {
  const { tr: t } = useLanguage();
  const searches = [
    {
      name: t("eBay sold listings"),
      source: "ebay" as const,
      href: searchUrl("https://www.ebay.com/sch/i.html", "_nkw", query, {
        LH_Sold: "1",
        LH_Complete: "1",
      }),
    },
    {
      name: "PriceCharting",
      source: "pricecharting" as const,
      href: searchUrl("https://www.pricecharting.com/search-products", "q", query, { type: "prices" }),
    },
    {
      name: "Beckett",
      source: "beckett" as const,
      href: searchUrl("https://www.beckett.com/search/", "term", query),
    },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-xs">{t("Check sold prices elsewhere:")}</span>
        {searches.map((s) => (
          <a
            key={s.name}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-card hover:bg-accent inline-flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-xs font-medium transition-colors"
          >
            <SourceMark source={s.source} size="sm" />
            {s.name}
            <ExternalLink className="text-muted-foreground size-3" />
          </a>
        ))}
      </div>

      <p className="text-muted-foreground text-[11px]">
        {t(
          "Rows compare the same card and set in the grade picked above. eBay figures are current asking prices, not sold prices, converted at about {rate} THB per USD.",
          { rate: THB_PER_USD },
        )}
      </p>
    </div>
  );
}
