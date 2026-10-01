import { ArrowDownRight, ArrowUpRight, ExternalLink, Scale } from "lucide-react";

import { formatThb, formatUsd } from "@/lib/format";
import { ebaySoldListingsUrl, type EbayPriceQuote } from "@/lib/ebay";
import type { CardPriceQuote } from "@/lib/tcg-price";
import { THB_PER_USD } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

type Kind = "Asking" | "Sold" | "Market";

/** One source, drawn as a lane on the shared baht axis: a dot, optionally with a low–high band. */
interface Lane {
  key: string;
  name: string;
  mono: string;
  kind: Kind;
  pointThb: number | null;
  rangeThb?: [number, number];
  /** Main figure as the source reports it (THB, or USD for outside sources). */
  price: string | null;
  /** "≈ THB …" for USD sources, so they read on the same scale. */
  approx?: string;
  note: string;
  href?: string;
  highlight?: boolean;
}

function searchUrl(base: string, param: string, query: string, extra: Record<string, string> = {}) {
  return `${base}?${new URLSearchParams({ [param]: query, ...extra }).toString()}`;
}

const usdToThb = (usd: number) => Math.round(usd * THB_PER_USD);

/** A round axis maximum a little above the largest value, so ticks land on readable numbers. */
function niceMax(value: number) {
  const padded = value * 1.08;
  const step = 10 ** Math.floor(Math.log10(padded));
  return Math.ceil(padded / (step / 2)) * (step / 2);
}

function Monogram({ text, strong }: { text: string; strong?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold tracking-tight",
        strong ? "bg-foreground text-background" : "bg-muted text-foreground",
      )}
    >
      {text}
    </span>
  );
}

/**
 * Compares this listing with every price source we have, on one baht scale:
 * a headline verdict, then one lane per source (dot = price, band = low–high
 * range) with this listing's price drawn as a reference line through all of
 * them. Outside prices keep their original USD figure next to an approximate
 * baht conversion. Sources we can't query (Beckett, PriceCharting, eBay's
 * sold comps) are one-click searches pre-filled for this exact card.
 */
export async function PlatformPriceTable({
  priceThb,
  forSale,
  gradeLabel,
  marketQuery,
  cardMart,
  tcg,
  ebay,
  graded,
}: {
  priceThb: number | null;
  forSale: boolean;
  gradeLabel: string;
  marketQuery: string;
  cardMart: {
    saleCount: number;
    medianSaleThb: number | null;
    lastSaleThb: number | null;
    listingCount: number;
    lowestAskThb: number | null;
    highestAskThb: number | null;
    saleLookbackDays: number;
  };
  tcg: CardPriceQuote | null;
  ebay: EbayPriceQuote | null;
  // TCGplayer only prices raw cards, so its row is left out for a graded slab.
  graded: boolean;
}) {
  const t = await getT();
  const listingThb = forSale ? priceThb : null;

  const sameCardRange =
    cardMart.lowestAskThb != null && cardMart.highestAskThb != null && cardMart.highestAskThb !== cardMart.lowestAskThb
      ? ([cardMart.lowestAskThb, cardMart.highestAskThb] as [number, number])
      : undefined;

  const lanes: Lane[] = [
    {
      key: "listing",
      name: t("This listing"),
      mono: "CM",
      kind: "Asking",
      pointThb: listingThb,
      price: listingThb != null ? formatThb(listingThb) : null,
      note: forSale ? gradeLabel : t("Not listed for sale right now"),
      highlight: true,
    },
    {
      key: "same",
      name: t("CardMart — same card"),
      mono: "CM",
      kind: "Asking",
      pointThb: sameCardRange ? null : cardMart.lowestAskThb,
      rangeThb: sameCardRange,
      price:
        cardMart.lowestAskThb == null
          ? null
          : sameCardRange
            ? `${formatThb(sameCardRange[0])} – ${formatThb(sameCardRange[1])}`
            : formatThb(cardMart.lowestAskThb),
      note:
        cardMart.listingCount > 0
          ? t(cardMart.listingCount === 1 ? "{count} live listing" : "{count} live listings", { count: cardMart.listingCount })
          : t("No live listings"),
    },
    {
      key: "sold",
      name: t("CardMart — median sale"),
      mono: "CM",
      kind: "Sold",
      pointThb: cardMart.medianSaleThb,
      price: cardMart.medianSaleThb != null ? formatThb(cardMart.medianSaleThb) : null,
      note:
        cardMart.saleCount > 0
          ? t(cardMart.saleCount === 1 ? "{count} sale in {days} days" : "{count} sales in {days} days", {
              count: cardMart.saleCount,
              days: cardMart.saleLookbackDays,
            })
          : t("No completed sales in {days} days", { days: cardMart.saleLookbackDays }),
    },
    {
      key: "ebay",
      name: "eBay",
      mono: "eB",
      kind: "Asking",
      pointThb: ebay ? usdToThb(ebay.medianPriceUsd) : null,
      rangeThb: ebay && ebay.itemCount > 1 ? [usdToThb(ebay.lowPriceUsd), usdToThb(ebay.highPriceUsd)] : undefined,
      price: ebay ? formatUsd(ebay.medianPriceUsd) : null,
      approx: ebay ? `≈ ${formatThb(usdToThb(ebay.medianPriceUsd))}` : undefined,
      note: ebay
        ? `${t("Median of {count} active listings", { count: ebay.itemCount })} · ${formatUsd(ebay.lowPriceUsd)}–${formatUsd(ebay.highPriceUsd)}`
        : t("No exact match listed right now"),
      href: searchUrl("https://www.ebay.com/sch/i.html", "_nkw", marketQuery),
    },
    ...(graded ? [] : [{
      key: "tcg",
      name: "TCGplayer",
      mono: "TCG",
      kind: "Market",
      pointThb: tcg?.marketPriceUsd != null ? usdToThb(tcg.marketPriceUsd) : null,
      price: tcg?.marketPriceUsd != null ? formatUsd(tcg.marketPriceUsd) : null,
      approx: tcg?.marketPriceUsd != null ? `≈ ${formatThb(usdToThb(tcg.marketPriceUsd))}` : undefined,
      note: tcg?.marketPriceUsd != null ? `${t("Ungraded (raw) card")} · ${tcg.matchedName}` : t("Ungraded card prices"),
      href: searchUrl("https://www.tcgplayer.com/search/all/product", "q", tcg?.matchedName ?? marketQuery),
    } satisfies Lane]),
  ];

  const values = lanes.flatMap((l) => [l.pointThb, ...(l.rangeThb ?? [])]).filter((v): v is number => v != null && v > 0);
  const axisMax = values.length ? niceMax(Math.max(...values)) : 0;
  const pos = (v: number) => `${Math.min(100, (v / axisMax) * 100)}%`;
  const ticks = [0, axisMax / 2, axisMax];

  // Headline: this listing against the best outside reference we have.
  const reference =
    ebay != null
      ? { label: t("eBay median asking price"), thb: usdToThb(ebay.medianPriceUsd) }
      : cardMart.medianSaleThb != null
        ? { label: t("CardMart median sale"), thb: cardMart.medianSaleThb }
        : null;
  const diffPct = listingThb != null && reference ? ((listingThb - reference.thb) / reference.thb) * 100 : null;

  const searches = [
    { name: t("eBay sold listings"), mono: "eB", href: ebaySoldListingsUrl(marketQuery) },
    { name: "PriceCharting", mono: "PC", href: searchUrl("https://www.pricecharting.com/search-products", "q", marketQuery, { type: "prices" }) },
    { name: "Beckett", mono: "B", href: searchUrl("https://www.beckett.com/search/", "term", marketQuery) },
  ];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="bg-foreground text-background flex size-7 items-center justify-center rounded-lg">
          <Scale className="size-3.5" />
        </div>
        <h2 className="text-lg font-semibold">{t("Price Comparison")}</h2>
      </div>

      <div className="bg-card overflow-hidden rounded-xl border">
        {/* Headline verdict */}
        <div className="flex flex-wrap items-end justify-between gap-3 border-b p-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground text-xs">{t("This listing")}</span>
            <span className="text-2xl leading-none font-bold tabular-nums">{listingThb != null ? formatThb(listingThb) : "—"}</span>
          </div>
          {diffPct != null && reference && (
            <div className="flex items-center gap-2 text-sm">
              {Math.abs(diffPct) < 1 ? null : diffPct < 0 ? (
                <ArrowDownRight className="text-success size-4" />
              ) : (
                <ArrowUpRight className="text-destructive size-4" />
              )}
              <span>
                <span className="font-semibold">
                  {Math.abs(diffPct) < 1
                    ? t("About the same as")
                    : t(diffPct < 0 ? "{pct}% below" : "{pct}% above", { pct: Math.abs(diffPct).toFixed(0) })}
                </span>{" "}
                <span className="text-muted-foreground">
                  {reference.label} ({formatThb(reference.thb)})
                </span>
              </span>
            </div>
          )}
        </div>

        {/* One lane per source on a shared baht axis */}
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
                <Monogram text={lane.mono} strong={lane.highlight} />
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
                          className="bg-foreground/15 absolute top-1/2 h-2 -translate-y-1/2 rounded-full"
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
                            lane.highlight ? "bg-foreground size-3.5" : "bg-muted-foreground size-2.5",
                          )}
                          style={{ left: pos(lane.pointThb) }}
                          title={`${lane.name}: ${formatThb(lane.pointThb)}`}
                        />
                      )}
                    </>
                  )}
                </div>

                <div className="col-start-3 row-start-1 flex flex-col items-end text-right sm:col-start-4">
                  {lane.price ? (
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

        {/* Axis labels, aligned to the track column from sm up */}
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

      {/* Sources we can only search, not query */}
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
            <span className="bg-muted flex size-5 items-center justify-center rounded-full text-[8px] font-bold">{s.mono}</span>
            {s.name}
            <ExternalLink className="text-muted-foreground size-3" />
          </a>
        ))}
      </div>

      <p className="text-muted-foreground text-[11px]">
        {t("Every row compares the same card, set and grade as this listing. eBay figures are current asking prices, not sold prices, converted at about {rate} THB per USD.", { rate: THB_PER_USD })}
      </p>
    </section>
  );
}
