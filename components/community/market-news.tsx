"use client";

import Link from "next/link";
import { Activity, Banknote, ChartColumn, ReceiptText, ShoppingBag, Tag } from "lucide-react";

import { useMoney } from "@/components/currency-provider";
import type { getMarketOverview } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useT } from "@/components/landing/language-provider";

type Overview = Awaited<ReturnType<typeof getMarketOverview>>;

const UPDATE_KIND_LABELS: Record<Overview["updates"][number]["kind"], string> = {
  listed: "Listed",
  "price-up": "Price up",
  "price-down": "Price down",
  sold: "Sold",
};

/** Headline market figures: listings, asking and sale prices, 30-day volume. */
export function MarketStats({ overview }: { overview: Overview }) {
  const money = useMoney();
  const t = useT();
  const stats = [
    { icon: ShoppingBag, label: "Live listings", value: overview.activeListings.toLocaleString() },
    { icon: Tag, label: "Median asking price", value: overview.medianAskThb != null ? money(overview.medianAskThb) : "—" },
    { icon: ReceiptText, label: "Sales · 30 days", value: overview.sales30d.toLocaleString() },
    { icon: Banknote, label: "Median sale · 30 days", value: overview.medianSale30dThb != null ? money(overview.medianSale30dThb) : "—" },
    { icon: ChartColumn, label: "Volume · 30 days", value: money(overview.volume30dThb) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
      {stats.map(({ icon: Icon, label, value }) => (
        <div key={label} className="bg-card flex min-w-0 flex-col gap-2 rounded-2xl border p-4 xl:flex-row xl:items-center xl:gap-3">
          <span className="bg-secondary flex size-9 shrink-0 items-center justify-center rounded-xl">
            <Icon className="size-4" />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="text-muted-foreground truncate text-xs">{t(label)}</span>
            <span className="truncate text-lg font-bold tabular-nums">{value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/** The latest real listings, price changes and sales, newest first. */
export function RecentActivity({ updates }: { updates: Overview["updates"] }) {
  const money = useMoney();
  const t = useT();
  return (
    <section className="bg-card flex min-w-0 flex-col rounded-2xl border">
      <h2 className="eyebrow text-muted-foreground flex items-center gap-2 border-b px-4 py-3">
        <Activity className="size-3.5" />
        {t("Recent activity")}
      </h2>
      {updates.length ? (
        <ul className="divide-y">
          {updates.map((update, index) => (
            <li key={`${update.kind}-${update.asset.id}-${index}`}>
              <Link
                href={`/item/${update.asset.id}`}
                className="hover:bg-secondary/60 flex items-center justify-between gap-3 px-4 py-3 transition-colors"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{update.asset.name}</span>
                  <span
                    className={cn(
                      "text-xs",
                      update.kind === "price-up" && "text-success",
                      update.kind === "price-down" && "text-destructive",
                      (update.kind === "listed" || update.kind === "sold") && "text-muted-foreground",
                    )}
                  >
                    {t(UPDATE_KIND_LABELS[update.kind])}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums">{money(update.priceThb)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground px-4 py-6 text-center text-sm">{t("No market activity yet.")}</p>
      )}
    </section>
  );
}
