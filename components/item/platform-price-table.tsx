import { ExternalLink, Scale } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatThb, formatUsd } from "@/lib/format";
import { ebaySoldListingsUrl, type EbayPriceQuote } from "@/lib/ebay";
import type { CardPriceQuote } from "@/lib/tcg-price";
import { cn } from "@/lib/utils";

interface Row {
  source: string;
  kind: "Asking" | "Sold" | "Market" | "Search";
  price: string | null;
  note: string;
  href?: string;
  highlight?: boolean;
}

function searchUrl(base: string, param: string, query: string, extra: Record<string, string> = {}) {
  return `${base}?${new URLSearchParams({ [param]: query, ...extra }).toString()}`;
}

/**
 * One table comparing this listing against every price source we have, from
 * CardMart's own real sales and listings to outside marketplaces. Rows with a
 * live figure show it; outside sources we can't query directly (Beckett,
 * PriceCharting, TCGplayer without an API key) are still listed as one-click
 * searches pre-filled for this exact card, so the comparison is always complete.
 */
export function PlatformPriceTable({
  priceThb,
  forSale,
  gradeLabel,
  marketQuery,
  cardMart,
  tcg,
  ebay,
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
}) {
  const rows: Row[] = [
    {
      source: "CardMart — this listing",
      kind: "Asking",
      price: forSale && priceThb != null ? formatThb(priceThb) : null,
      note: forSale ? gradeLabel : "Not listed for sale right now",
      highlight: true,
    },
    {
      source: "CardMart — same card",
      kind: "Asking",
      price:
        cardMart.lowestAskThb != null
          ? cardMart.listingCount > 1 && cardMart.highestAskThb !== cardMart.lowestAskThb
            ? `${formatThb(cardMart.lowestAskThb)} – ${formatThb(cardMart.highestAskThb!)}`
            : formatThb(cardMart.lowestAskThb)
          : null,
      note:
        cardMart.listingCount > 0
          ? `${cardMart.listingCount} live listing${cardMart.listingCount === 1 ? "" : "s"}, lowest to highest`
          : "No live listings",
    },
    {
      source: "CardMart — median sale",
      kind: "Sold",
      price: cardMart.medianSaleThb != null ? formatThb(cardMart.medianSaleThb) : null,
      note:
        cardMart.saleCount > 0
          ? `Median of ${cardMart.saleCount} completed sale${cardMart.saleCount === 1 ? "" : "s"} in ${cardMart.saleLookbackDays} days${
              cardMart.lastSaleThb != null ? ` · last ${formatThb(cardMart.lastSaleThb)}` : ""
            }`
          : `No completed sales in ${cardMart.saleLookbackDays} days`,
    },
    {
      source: "eBay",
      kind: ebay ? "Asking" : "Search",
      price: ebay ? formatUsd(ebay.medianPriceUsd) : null,
      note: ebay
        ? `Median of ${ebay.itemCount} active listing${ebay.itemCount === 1 ? "" : "s"} · ${formatUsd(ebay.lowPriceUsd)}–${formatUsd(ebay.highPriceUsd)}`
        : "Sold listings for this card and grade",
      href: ebaySoldListingsUrl(marketQuery),
    },
    {
      source: "TCGplayer",
      kind: tcg?.marketPriceUsd != null ? "Market" : "Search",
      price: tcg?.marketPriceUsd != null ? formatUsd(tcg.marketPriceUsd) : null,
      note: tcg?.marketPriceUsd != null ? `Ungraded market price · ${tcg.matchedName}` : "Ungraded card prices",
      href: searchUrl("https://www.tcgplayer.com/search/all/product", "q", tcg?.matchedName ?? marketQuery),
    },
    {
      source: "Beckett",
      kind: "Search",
      price: null,
      note: "Beckett marketplace and price guide",
      href: searchUrl("https://www.beckett.com/search/", "term", marketQuery),
    },
    {
      source: "PriceCharting",
      kind: "Search",
      price: null,
      note: "Graded sale history by grade",
      href: searchUrl("https://www.pricecharting.com/search-products", "q", marketQuery, { type: "prices" }),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="bg-foreground text-background flex size-7 items-center justify-center rounded-lg">
          <Scale className="size-3.5" />
        </div>
        <h2 className="text-lg font-semibold">Price Comparison</h2>
      </div>
      <div className="detail-panel overflow-x-auto rounded-xl border">
        <Table className="min-w-[560px]">
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead className="w-24">Type</TableHead>
              <TableHead className="text-right">Price</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.source} className={cn(row.highlight && "bg-muted/40")}>
                <TableCell className="whitespace-normal">
                  <div className="flex flex-col gap-0.5">
                    {row.href ? (
                      <a
                        href={row.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex w-fit items-center gap-1 font-medium hover:underline"
                      >
                        {row.source} <ExternalLink className="size-3" />
                      </a>
                    ) : (
                      <span className="font-medium">{row.source}</span>
                    )}
                    <span className="text-muted-foreground text-xs">{row.note}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]">
                    {row.kind}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {row.price ?? (
                    <span className="text-muted-foreground text-xs font-normal">{row.href ? "Open search" : "—"}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-muted-foreground text-[11px]">
        CardMart figures are in THB from real listings and completed sales. Outside prices stay in their own
        currency (USD) and aren&apos;t converted. eBay figures are asking prices, not sold prices.
      </p>
    </div>
  );
}
