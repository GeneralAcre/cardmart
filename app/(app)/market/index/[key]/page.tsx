import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { IndexMembers, IndexQuote } from "@/components/marketplace/index-detail";
import { getIndexDetail, type IndexKey, type IndexMember } from "@/lib/stats";
import { priceStats } from "@/lib/stats-math";
import { formatThb } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";
import { getLocale, getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

// URL slug → index. The links come from the index cards on the Market page.
const SLUGS: Record<string, IndexKey> = { cardmart: "ALL", pokemon: "POKEMON", "one-piece": "ONE_PIECE" };
const SLUG_OF: Record<IndexKey, string> = { ALL: "cardmart", POKEMON: "pokemon", ONE_PIECE: "one-piece" };

const INFO: Record<IndexKey, { title: string; description: string }> = {
  ALL: {
    title: "CardMart Index",
    description: "Every card on CardMart that has a market price, each in its own grade, weighted equally.",
  },
  POKEMON: {
    title: "Pokémon Index",
    description: "Well-known Pokémon cards in PSA 10, priced every day from eBay, whether or not they're listed on CardMart.",
  },
  ONE_PIECE: {
    title: "One Piece Index",
    description: "Well-known One Piece cards in PSA 10, priced every day from eBay, whether or not they're listed on CardMart.",
  },
};

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
  const { key: slug } = await params;
  const key = SLUGS[slug];
  if (!key) notFound();
  await getCurrentUser();
  const [{ index, members, all }, t, locale] = await Promise.all([getIndexDetail(key), getT(), getLocale()]);
  const info = INFO[key];
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
  const up = members.filter((m) => (m.change1d ?? 0) > 0.05).length;
  const down = members.filter((m) => (m.change1d ?? 0) < -0.05).length;
  const flat = members.length - up - down;
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
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <Link
        href="/marketplace"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" /> {t("Market")}
      </Link>

      <div className="mb-4 flex max-w-2xl flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t(info.title)}</h1>
        <p className="text-muted-foreground text-sm">{t(info.description)}</p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-8">
          <IndexQuote index={index} name={t(info.title)} />

          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">{t("Key statistics")}</h2>
            <div className="bg-card grid grid-cols-1 rounded-xl border sm:grid-cols-2">
              <div className="flex flex-col px-4 sm:border-r">
                <Row label={t("Previous close")} value={points.length >= 2 ? formatLevel(points.at(-2)!.price) : "—"} />
                <Row
                  label={t("52-week range")}
                  value={yearLow != null && yearHigh != null ? `${formatLevel(yearLow)} – ${formatLevel(yearHigh)}` : "—"}
                />
                <Row label={t("All-time high")} value={stats.high ? formatLevel(stats.high.price) : "—"} note={stats.high ? day(stats.high.t) : undefined} />
                <Row label={t("All-time low")} value={stats.low ? formatLevel(stats.low.price) : "—"} note={stats.low ? day(stats.low.t) : undefined} />
                <Row label={t("Start date")} value={points[0] ? day(points[0].t) : "—"} note={t("Base 1,000")} />
              </div>
              <div className="flex flex-col border-t px-4 sm:border-t-0">
                <Row label={t("Cards in this index")} value={index.constituents} />
                <Row
                  label={t("Advancers / decliners")}
                  value={
                    <>
                      <span className="text-success">{up}</span> / <span className="text-destructive">{down}</span>
                    </>
                  }
                  note={flat > 0 ? t("{count} unchanged", { count: flat }) : undefined}
                />
                <Row label={t("Daily swing")} value={stats.volatility != null ? `±${stats.volatility.toFixed(2)}%` : "—"} />
                <Row label={t("Combined value")} value={formatThb(combinedValue)} note={t("One copy of each")} />
                <Row label={t("7 days")} value={<span className={toneClass(index.change7d)}>{formatPct(index.change7d)}</span>} />
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">{t("Cards in this index")}</h2>
            <IndexMembers members={members} longLabel={longLabel} />
            <p className="text-muted-foreground text-[11px]">
              {t("Prices are eBay's daily median asking price for each card and grade, converted to baht.")}
            </p>
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">{t("Top movers today")}</h2>
          <MoverList title={t("Gainers")} members={gainers} />
          <MoverList title={t("Losers")} members={losers} />

          <h2 className="mt-2 text-lg font-semibold">{t("Other indexes")}</h2>
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
                    <span className="font-medium">{t(INFO[i.key].title)}</span>
                    <span className="flex items-center gap-2 tabular-nums">
                      <span className="font-semibold">{level != null ? formatLevel(level) : "—"}</span>
                      <span className={cn("text-xs", toneClass(i.change1d))}>{formatPct(i.change1d)}</span>
                    </span>
                  </Link>
                );
              })}
          </div>
        </aside>
      </div>
    </div>
  );
}
