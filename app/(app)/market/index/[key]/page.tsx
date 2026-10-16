import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { IndexChart, IndexMembers } from "@/components/marketplace/index-detail";
import { getIndexDetail, type IndexKey } from "@/lib/stats";
import { getCurrentUser } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

// URL slug → index. The links come from the index cards on the Market page.
const SLUGS: Record<string, IndexKey> = { cardmart: "ALL", pokemon: "POKEMON", "one-piece": "ONE_PIECE" };

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

const formatLevel = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const toneClass = (pct: number | null) =>
  pct == null || Math.abs(pct) < 0.05 ? "text-muted-foreground" : pct > 0 ? "text-success" : "text-destructive";
const formatPct = (pct: number | null) => (pct == null ? "—" : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`);

export default async function IndexPage({ params }: { params: Promise<{ key: string }> }) {
  const { key: slug } = await params;
  const key = SLUGS[slug];
  if (!key) notFound();
  await getCurrentUser();
  const [{ index, members }, t] = await Promise.all([getIndexDetail(key), getT()]);
  const info = INFO[key];
  const last = index.points.at(-1);
  const longLabel = index.change30d != null ? "30D" : "Since start";
  const ranked = members.filter((m) => m.change30dOrSince != null);
  const best = ranked[0] ?? null;
  const worst = ranked.length > 1 ? ranked.at(-1)! : null;

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <Link
        href="/marketplace"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" /> {t("Market")}
      </Link>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-2xl flex-col gap-1">
          <h1 className="text-2xl font-semibold">{t(info.title)}</h1>
          <p className="text-muted-foreground text-sm">{t(info.description)}</p>
        </div>
        <div className="flex items-end gap-6">
          <span className="text-3xl font-bold tabular-nums">{last ? formatLevel(last.price) : "—"}</span>
          {[
            { label: "7D", pct: index.change7d },
            { label: longLabel, pct: index.change30d ?? index.change30dOrSince },
          ].map((c) => (
            <span key={c.label} className="flex flex-col items-end">
              <span className="text-muted-foreground text-[10px] tracking-wide uppercase">{t(c.label)}</span>
              <span className={cn("text-base font-semibold tabular-nums", toneClass(c.pct))}>{formatPct(c.pct)}</span>
            </span>
          ))}
        </div>
      </div>

      <IndexChart index={index} />

      {best && (
        <div className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2">
          {[
            { label: "Best performer", m: best },
            ...(worst ? [{ label: "Worst performer", m: worst }] : []),
          ].map(({ label, m }) => (
            <div key={label} className="bg-card flex items-center justify-between gap-3 p-4">
              <span className="flex min-w-0 flex-col">
                <span className="text-muted-foreground text-xs">{t(label)}</span>
                <span className="truncate font-semibold">{m.name}</span>
                <span className="text-muted-foreground truncate text-xs">{m.subtitle}</span>
              </span>
              <span className={cn("shrink-0 text-xl font-bold tabular-nums", toneClass(m.change30dOrSince))}>
                {formatPct(m.change30dOrSince)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("Cards in this index")}</h2>
        <span className="text-muted-foreground text-sm">
          {t(members.length === 1 ? "{count} card" : "{count} cards", { count: members.length })}
        </span>
      </div>
      <IndexMembers members={members} longLabel={longLabel} />
      <p className="text-muted-foreground mt-3 text-[11px]">
        {t("Ranked by price change. Prices are eBay's daily median asking price for each card and grade, converted to baht.")}
      </p>
    </div>
  );
}
