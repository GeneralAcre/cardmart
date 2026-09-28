"use client";

import Link from "next/link";

import { formatThb } from "@/lib/format";
import type { getMarketOverview } from "@/lib/queries";
import { useT } from "@/components/landing/language-provider";

type Overview = Awaited<ReturnType<typeof getMarketOverview>>;
const UPDATE_KIND_LABELS: Record<Overview["updates"][number]["kind"], string> = {
  listed: "Listed",
  "price-up": "Price up",
  "price-down": "Price down",
  sold: "Sold",
};

export function LeaderboardMarket({ overview }: { overview: Overview }) {
  const t = useT();
  const stats = [
    { label: "Live listings", value: overview.activeListings.toLocaleString() },
    { label: "Median asking price", value: overview.medianAskThb != null ? formatThb(overview.medianAskThb) : "—" },
    { label: "Sales · 30 days", value: overview.sales30d.toLocaleString() },
    { label: "Median sale · 30 days", value: overview.medianSale30dThb != null ? formatThb(overview.medianSale30dThb) : "—" },
    { label: "Volume · 30 days", value: formatThb(overview.volume30dThb) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-card grid grid-cols-2 gap-x-5 gap-y-3 rounded-xl border px-4 py-3 sm:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label} className="flex min-w-0 flex-col gap-0.5">
            <span className="text-muted-foreground truncate text-[11px]">{t(stat.label)}</span>
            <span className="text-sm leading-tight font-semibold tabular-nums sm:text-base">{stat.value}</span>
          </div>
        ))}
      </div>

      <section className="flex min-w-0 flex-col gap-2">
          <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">{t("Recent activity")}</h2>
          {overview.updates.length ? (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {overview.updates.slice(0, 3).map((update, index) => (
                <li key={`${update.kind}-${update.asset.id}-${index}`} className="min-w-0">
                  <Link href={`/item/${update.asset.id}`} className="bg-card hover:bg-accent flex min-w-0 items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-colors">
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium">{update.asset.name}</span>
                      <span className="text-muted-foreground text-[11px]">{t(UPDATE_KIND_LABELS[update.kind])}</span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold tabular-nums">{formatThb(update.priceThb)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="text-muted-foreground text-xs">{t("No market activity yet.")}</p>}
      </section>
    </div>
  );
}
