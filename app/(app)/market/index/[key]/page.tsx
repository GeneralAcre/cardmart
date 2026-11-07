import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { notFound } from "next/navigation";

import { IndexMembers, IndexQuote, IndexSparkline } from "@/components/marketplace/index-detail";
import { getIndexDetail, getMarketIndexes, getMyIndex, getUserIndex, type IndexMember, type MarketIndex } from "@/lib/stats";
import { priceStats } from "@/lib/stats-math";
import { getMoney } from "@/lib/currency-server";
import { getCurrentUser } from "@/lib/session";
import { getLocale, getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import { PageTour } from "@/components/tour/page-tour";

// URL slug → index. The links come from the index cards on the Market page.
const SLUGS: Record<string, MarketIndex["key"]> = { cardmart: "ALL", pokemon: "POKEMON", "one-piece": "ONE_PIECE", mine: "MINE" };
const SLUG_OF: Record<MarketIndex["key"], string> = { ALL: "cardmart", POKEMON: "pokemon", ONE_PIECE: "one-piece", MINE: "mine" };

const INFO: Record<MarketIndex["key"], { title: string; description: string }> = {
  ALL: {
    title: "CardMart Index",
    description: "Every card on CardMart that has a market price, each in its own grade, weighted equally.",
  },
  POKEMON: {
    title: "Pokémon Index",
    description:
      "The 50 most valuable Pokémon cards right now, by TCGplayer market price. A card that falls out of the top 50 leaves the index and the next most valuable one joins.",
  },
  ONE_PIECE: {
    title: "One Piece Index",
    description:
      "The 50 most valuable One Piece cards right now, by TCGplayer market price. A card that falls out of the top 50 leaves the index and the next most valuable one joins.",
  },
  MINE: {
    title: "My Index",
    description:
      "The cards you picked, each in its own grade, weighted equally. Only you can see it. Edit it from its card on the Market page.",
  },
};

/** Your own index plus the three market ones; the market ones on their own otherwise. `ownId` picks one of your extra indexes. */
async function loadDetail(key: MarketIndex["key"], userId: string, ownId: string | null) {
  if (key !== "MINE") return { name: null, ...(await getIndexDetail(key)) };
  const [mine, all] = await Promise.all([ownId ? getUserIndex(userId, ownId) : getMyIndex(userId), getMarketIndexes()]);
  if (!mine) notFound();
  return { name: mine.name, index: mine.index, members: mine.members, all };
}

const DAY = 86_400_000;
const formatLevel = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const toneClass = (pct: number | null) =>
  pct == null || Math.abs(pct) < 0.05 ? "text-muted-foreground" : pct > 0 ? "text-success" : "text-destructive";
const formatPct = (pct: number | null) => (pct == null ? "—" : `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`);

/** One label-and-value row of the key statistics table. */
function Row({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b py-2.5 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex min-w-0 items-center gap-2 text-right">
        {note && <span className="text-muted-foreground truncate text-xs">{note}</span>}
        <span className="font-semibold whitespace-nowrap tabular-nums">{value}</span>
      </span>
    </div>
  );
}

function MoverList({ title, members }: { title: string; members: IndexMember[] }) {
  return (
    <div className="bg-card rounded-xl border px-4 py-1">
      <p className="text-muted-foreground border-b py-2 text-xs font-medium">{title}</p>
      {members.length === 0 ? (
        <p className="text-muted-foreground py-3 text-sm">—</p>
      ) : (
        members.map((m) => (
          <div key={m.key} className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-b-0">
            <span className="min-w-0 truncate">{m.name}</span>
            <span className={cn("shrink-0 font-semibold tabular-nums", toneClass(m.change1d))}>{formatPct(m.change1d)}</span>
          </div>
        ))
      )}
    </div>
  );
}

export default async function IndexPage({ params }: { params: Promise<{ key: string }> }) {
  const money = await getMoney();
  const { key: slug } = await params;
  // Your extra indexes live at /market/index/mine-<id>.
  const ownId = slug.startsWith("mine-") ? slug.slice("mine-".length) : null;
  const key = ownId ? "MINE" : SLUGS[slug];
  if (!key) notFound();
  const user = await getCurrentUser();
  const [{ name, index, members, all }, t, locale] = await Promise.all([loadDetail(key, user.id, ownId), getT(), getLocale()]);
  const info = INFO[key];
  // Your own index shows the name you gave it.
  const title = name ?? t(info.title);
  const dateLocale = locale === "th" ? "th-TH" : "en-US";
  const day = (ms: number) => new Date(ms).toLocaleDateString(dateLocale, { day: "numeric", month: "short", year: "numeric" });

  // Key statistics, all from the index's own daily levels and its cards.
  const points = index.points;
  const last = points.at(-1);
  const stats = priceStats(points);
  const yearAgo = last ? last.t - 365 * DAY : 0;
  const lastYear = points.filter((p) => p.t >= yearAgo);
  const yearLow = lastYear.length ? Math.min(...lastYear.map((p) => p.price)) : null;
  const yearHigh = lastYear.length ? Math.max(...lastYear.map((p) => p.price)) : null;
  const combinedValue = members.reduce((sum, m) => sum + m.latestThb, 0);
  const byDay = [...members].filter((m) => m.change1d != null).sort((a, b) => b.change1d! - a.change1d!);
  const gainers = byDay.filter((m) => m.change1d! > 0.05).slice(0, 3);
  const losers = byDay.filter((m) => m.change1d! < -0.05).reverse().slice(0, 3);
  const longLabel =
    index.change30d != null
      ? t("30D")
      : points[0]
        ? t("Since {date}", { date: new Date(points[0].t).toLocaleDateString(dateLocale, { day: "numeric", month: "short" }) })
        : t("30D");

  return (
    <div className="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <PageTour id="index" />
      <Breadcrumbs items={[{ label: t("Market"), href: "/marketplace" }, { label: title }]} />

      <div className="mb-4 flex max-w-2xl flex-col gap-1">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-muted-foreground text-sm">{t(info.description)}</p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-8">
          <div className="order-1 lg:order-none" data-tour="index-quote">
            <IndexQuote index={index} name={title} />
          </div>

          <section className="order-3 flex flex-col gap-2 lg:order-none" data-tour="index-members">
            <h2 className="text-lg font-semibold">{t("Cards in this index")}</h2>
            <IndexMembers members={members} longLabel={longLabel} />
            <p className="text-muted-foreground text-[11px]">
              {key === "ALL" || key === "MINE"
                ? t("Prices are eBay's daily median asking price for each card and grade, converted to baht.")
                : t("Prices are TCGplayer's market price for the ungraded card, in baht. The top 50 is re-ranked once a day.")}
            </p>
          </section>
          <section className="order-4 flex flex-col gap-2 lg:order-none" data-tour="index-other">
            <h2 className="text-lg font-semibold">{t("Other indexes")}</h2>
            <div className="bg-card rounded-xl border px-4 py-1">
              {all
                .filter((i) => i.key !== key)
                .map((i) => {
                  const level = i.points.at(-1)?.price;
                  return (
                    <Link
                      key={i.key}
                      href={`/market/index/${SLUG_OF[i.key]}`}
                      className="hover:text-foreground flex items-center justify-between gap-3 border-b py-2.5 text-sm last:border-b-0"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">{t(INFO[i.key].title)}</span>
                      <IndexSparkline index={i} />
                      <span className="flex items-center gap-2 tabular-nums">
                        <span className="font-semibold">{level != null ? formatLevel(level) : "—"}</span>
                        <span className={cn("text-xs", toneClass(i.change1d))}>{formatPct(i.change1d)}</span>
                      </span>
                    </Link>
                  );
                })}
            </div>
          </section>

        </div>

        <aside className="order-2 flex flex-col gap-4 lg:order-none" data-tour="index-movers">
          <h2 className="text-lg font-semibold">{t("Top movers today")}</h2>
          <MoverList title={t("Gainers")} members={gainers} />
          <MoverList title={t("Losers")} members={losers} />

          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">{t("Key statistics")}</h2>
            <div className="bg-card flex flex-col rounded-xl border px-4">
              <Row label={t("Previous close")} value={points.length >= 2 ? formatLevel(points.at(-2)!.price) : "—"} />
              <Row
                label={t("52-week range")}
                value={yearLow != null && yearHigh != null ? `${formatLevel(yearLow)} – ${formatLevel(yearHigh)}` : "—"}
              />
              <Row label={t("All-time high")} value={stats.high ? formatLevel(stats.high.price) : "—"} />
              <Row label={t("All-time low")} value={stats.low ? formatLevel(stats.low.price) : "—"} />
              <Row label={t("Start date")} value={points[0] ? day(points[0].t) : "—"} />
              <Row label={t("Cards in this index")} value={index.constituents} />
              <Row label={t("Daily swing")} value={stats.volatility != null ? `±${stats.volatility.toFixed(2)}%` : "—"} />
              <Row label={t("Combined value")} value={money(combinedValue)} />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
