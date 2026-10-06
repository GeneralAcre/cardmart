import Image from "next/image";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, BarChart3, Bookmark, CircleDollarSign, Crown, Flame, Newspaper, Tag } from "lucide-react";

import { CardArt } from "@/components/asset/card-art";
import { VerifiedBadge } from "@/components/store/verified-badge";
import { Badge } from "@/components/ui/badge";
import {
  getMarketOverview,
  getRankings,
  isPopularityTier,
  RANKING_TIERS,
  type MarketUpdate,
  type RankingRow,
  type RankingTier,
} from "@/lib/queries";
import { formatDateTime, formatGrade, formatThb } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";
import type { Translate } from "@/lib/i18n/translate";

function gradeText(a: { gradingCompany: string; grade: number | null; isBlackLabel: boolean }, t: Translate) {
  if (a.gradingCompany === "RAW") return t("Raw");
  return `${a.gradingCompany} ${formatGrade(a.grade)}${a.isBlackLabel ? " · Black Label" : ""}`;
}

export default async function MarketPage({ searchParams }: { searchParams: Promise<{ tier?: string }> }) {
  const { tier: tierParam } = await searchParams;
  const tier: RankingTier = RANKING_TIERS.find((t) => t.key === tierParam)?.key ?? "grade-10";
  const tierInfo = RANKING_TIERS.find((t) => t.key === tier)!;
  const byPopularity = isPopularityTier(tier);

  const [overview, rankings, t] = await Promise.all([getMarketOverview(), getRankings(tier), getT()]);

  const stats = [
    { label: "Live listings", value: overview.activeListings.toLocaleString() },
    { label: "Median asking price", value: overview.medianAskThb != null ? formatThb(overview.medianAskThb) : "—" },
    { label: "Sales · 30 days", value: overview.sales30d.toLocaleString() },
    { label: "Median sale · 30 days", value: overview.medianSale30dThb != null ? formatThb(overview.medianSale30dThb) : "—" },
    { label: "Volume · 30 days", value: formatThb(overview.volume30dThb) },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t("Market")}</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          {t("Rankings, prices and the latest moves across CardMart. Every number comes from real listings and completed escrow sales. Medians are used so one unusual sale can't skew them.")}
        </p>
      </div>

      <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
        {stats.map((s) => (
          <div key={s.label} className="bg-card flex flex-col gap-1 rounded-xl border p-4">
            <span className="text-muted-foreground text-xs">{t(s.label)}</span>
            <span className="text-lg leading-tight font-bold tabular-nums">{s.value}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1fr_340px]">
        <section className="flex min-w-0 flex-col gap-4">
          <div className="flex items-center gap-2">
            <div className="bg-foreground text-background flex size-7 items-center justify-center rounded-lg">
              <Crown className="size-3.5" />
            </div>
            <h2 className="text-lg font-semibold">{t("Rankings")}</h2>
          </div>

          <div className="bg-muted scrollbar-none flex w-fit max-w-full overflow-x-auto rounded-lg p-1">
            {RANKING_TIERS.map((item) => (
              <Link
                key={item.key}
                href={`/market?tier=${item.key}`}
                scroll={false}
                className={cn(
                  "rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap transition-colors",
                  item.key === tier ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="flex items-center gap-1.5">
                  {item.key === "trending" && <Flame className="size-3.5" />}
                  {item.key === "most-watched" && <Bookmark className="size-3.5" />}
                  {t(item.label)}
                </span>
              </Link>
            ))}
          </div>
          <p className="text-muted-foreground text-xs">
            {t(tierInfo.description)}{" "}
            {byPopularity
              ? t("Ranked by bookmarks on CardMart's watchlists.")
              : t("Ranked by value: the asking price if listed, otherwise the last real sale.")}
          </p>

          {rankings.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center">
              {byPopularity ? <Bookmark className="size-6" /> : <BarChart3 className="size-6" />}
              <p className="text-sm">
                {tier === "trending"
                  ? t("No cards bookmarked this week yet.")
                  : tier === "most-watched"
                    ? t("No cards on anyone's watchlist yet.")
                    : t("No {tier} cards with a price yet.", { tier: t(tierInfo.label) })}
              </p>
              {byPopularity && (
                <p className="max-w-xs text-xs">{t("Tap the bookmark on any card page to add it to your watchlist.")}</p>
              )}
            </div>
          ) : (
            <ol className="flex flex-col gap-2">
              {rankings.map((r, i) => (
                <li key={r.id}>
                  <Link
                    href={`/item/${r.id}`}
                    className="bg-card hover:bg-accent flex items-center gap-3 rounded-xl border p-2.5 pr-4 transition-colors"
                  >
                    <span
                      className={cn(
                        "w-7 shrink-0 text-center text-sm font-bold tabular-nums",
                        i < 3 ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {i + 1}
                    </span>
                    <div className="relative aspect-[3/4] w-10 shrink-0 overflow-hidden rounded-md border">
                      {r.photoUrl ? (
                        <Image src={r.photoUrl} alt={r.name} fill sizes="40px" className="object-cover" />
                      ) : (
                        <CardArt
                          themeIndex={r.themeIndex}
                          category={r.category}
                          gradingCompany={r.gradingCompany}
                          grade={r.grade}
                          isBlackLabel={r.isBlackLabel}
                          bordered={false}
                        />
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm font-semibold">{r.name}</span>
                      <span className="text-muted-foreground flex min-w-0 items-center gap-2 text-xs">
                        <span className="truncate">
                          {gradeText(r, t)} · {r.owner.name ?? r.owner.handle ?? t("Collector")}
                        </span>
                        <VerifiedBadge status={r.owner.kycStatus} className="hidden sm:inline-flex" />
                      </span>
                    </div>
                    {byPopularity ? <PopularityColumn row={r} tier={tier} t={t} /> : <ValueColumn row={r} t={t} />}
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <div className="bg-foreground text-background flex size-7 items-center justify-center rounded-lg">
              <Newspaper className="size-3.5" />
            </div>
            <h2 className="text-lg font-semibold">{t("Latest updates")}</h2>
          </div>
          {overview.updates.length === 0 ? (
            <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
              {t("No market activity yet.")}
            </p>
          ) : (
            <ul className="bg-card divide-y rounded-xl border">
              {overview.updates.map((u, i) => (
                <UpdateRow key={`${u.kind}-${u.asset.id}-${i}`} update={u} t={t} />
              ))}
            </ul>
          )}
          <Link href="/leaderboard" className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2">
            {t("See every card's gains and losses on the Leaderboard")}
          </Link>
        </section>
      </div>
    </div>
  );
}

/** Price, its 30-day change, and where it comes from. */
function ValueColumn({ row, t }: { row: RankingRow; t: Translate }) {
  return (
    <div className="flex shrink-0 flex-col items-end gap-0.5">
      <span className="text-sm font-bold tabular-nums">{row.valueThb != null ? formatThb(row.valueThb) : "—"}</span>
      <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
        {row.change30dPct != null && (
          <span className={row.change30dPct > 0 ? "text-success" : "text-destructive"}>
            {row.change30dPct > 0 ? "+" : ""}
            {row.change30dPct.toFixed(0)}% 30d
          </span>
        )}
        {row.valueSource === "ask" ? t("asking") : row.valueSource === "last-sale" ? t("last sale") : t("Not for sale")}
      </span>
    </div>
  );
}

/** How many people bookmarked it (this week, or overall), with the price underneath. */
function PopularityColumn({ row, tier, t }: { row: RankingRow; tier: RankingTier; t: Translate }) {
  const trending = tier === "trending";
  return (
    <div className="flex shrink-0 flex-col items-end gap-0.5">
      <span className="flex items-center gap-1 text-sm font-bold tabular-nums">
        {trending ? <Flame className="text-highlight size-3.5" /> : <Bookmark className="size-3.5" />}
        {trending
          ? t("+{count} this week", { count: row.watchersRecent })
          : t("{count} watching", { count: row.watchers })}
      </span>
      <span className="text-muted-foreground text-[11px] tabular-nums">
        {row.valueThb != null
          ? `${formatThb(row.valueThb)} · ${row.valueSource === "ask" ? t("asking") : t("last sale")}`
          : t("Not for sale")}
      </span>
    </div>
  );
}

const UPDATE_META = {
  listed: { icon: Tag, label: "Listed", className: "text-muted-foreground" },
  "price-up": { icon: ArrowUpRight, label: "Price up", className: "text-success" },
  "price-down": { icon: ArrowDownRight, label: "Price down", className: "text-destructive" },
  sold: { icon: CircleDollarSign, label: "Sold", className: "text-foreground" },
} as const;

function UpdateRow({ update, t }: { update: MarketUpdate; t: Translate }) {
  const meta = UPDATE_META[update.kind];
  const Icon = meta.icon;
  return (
    <li>
      <Link href={`/item/${update.asset.id}`} className="hover:bg-accent flex items-start gap-3 p-3 transition-colors">
        <Icon className={cn("mt-0.5 size-4 shrink-0", meta.className)} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm font-medium">{update.asset.name}</span>
          <span className="text-muted-foreground text-xs">
            <Badge variant="outline" className="mr-1.5 px-1.5 py-0 text-[10px]">
              {t(meta.label)}
            </Badge>
            {update.previousThb != null && update.kind !== "listed"
              ? `${formatThb(update.previousThb)} → ${formatThb(update.priceThb)}`
              : formatThb(update.priceThb)}
          </span>
          <span className="text-muted-foreground text-[11px]">
            {gradeText(update.asset, t)} · {formatDateTime(update.at)}
          </span>
        </div>
      </Link>
    </li>
  );
}
