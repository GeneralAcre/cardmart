"use client";

import Link from "next/link";
import { Activity } from "lucide-react";

import { formatThb } from "@/lib/format";
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
  const t = useT();
  const stats = [
    { label: "Live listings", value: overview.activeListings.toLocaleString() },
    { label: "Median asking price", value: overview.medianAskThb != null ? formatThb(overview.medianAskThb) : "—" },
    { label: "Sales · 30 days", value: overview.sales30d.toLocaleString() },
    { label: "Median sale · 30 days", value: overview.medianSale30dThb != null ? formatThb(overview.medianSale30dThb) : "—" },
    { label: "Volume · 30 days", value: formatThb(overview.volume30dThb) },
  ];

  return (
    <div className="bg-card grid grid-cols-2 gap-x-5 gap-y-3 rounded-2xl border px-4 py-3 sm:grid-cols-5">
      {stats.map((stat) => (
        <div key={stat.label} className="flex min-w-0 flex-col gap-0.5">
          <span className="text-muted-foreground truncate text-[11px]">{t(stat.label)}</span>
          <span className="text-sm leading-tight font-semibold tabular-nums sm:text-base">{stat.value}</span>
        </div>
      ))}
    </div>
  );
}

/** The latest real listings, price changes and sales, newest first. */
export function RecentActivity({ updates }: { updates: Overview["updates"] }) {
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
                <span className="shrink-0 text-sm font-semibold tabular-nums">{formatThb(update.priceThb)}</span>
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
