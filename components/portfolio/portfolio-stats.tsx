"use client";

import Link from "next/link";

import { formatThb } from "@/lib/format";
import { CARD_GAME_BADGE_CLASS, CARD_GAME_LABELS } from "@/lib/labels";
import type { PortfolioStats as Stats } from "@/lib/stats";
import { cn } from "@/lib/utils";
import { useT } from "@/components/landing/language-provider";

const tone = (v: number | null) =>
  v == null || Math.abs(v) < 0.05 ? "text-muted-foreground" : v > 0 ? "text-success" : "text-destructive";
const pct = (v: number | null) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`);

function Tile({
  label,
  children,
  sub,
  valueClassName = "text-3xl",
}: {
  label: string;
  children: React.ReactNode;
  sub?: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="bg-card flex min-w-0 flex-col gap-1.5 rounded-xl border p-4 sm:p-5">
      <span className="text-muted-foreground text-sm font-medium">{label}</span>
      <div className={cn("font-bold tracking-tight tabular-nums", valueClassName)}>{children}</div>
      {sub && <div className="text-muted-foreground text-sm">{sub}</div>}
    </div>
  );
}

/** One breakdown row: label, share bar and share. Value-weighted, or by count when nothing is priced. */
function Breakdown({ title, rows }: { title: string; rows: { label: React.ReactNode; key: string; share: number; detail: string }[] }) {
  const sorted = [...rows].sort((a, b) => b.share - a.share);
  return (
    <div className="bg-card flex min-w-0 flex-col gap-3 rounded-xl border p-4 sm:p-5">
      <h3 className="text-muted-foreground text-sm font-medium">{title}</h3>
      <ul className="flex flex-col gap-3">
        {sorted.map((row, i) => (
          <li key={row.key} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className={cn("min-w-0 truncate", i === 0 && "text-base font-bold")}>{row.label}</span>
              <span className={cn("shrink-0 tabular-nums", i === 0 ? "text-foreground text-base font-bold" : "text-muted-foreground")}>
                {Math.round(row.share * 100)}%
                <span className="text-muted-foreground ml-1.5 text-xs font-normal">{row.detail}</span>
              </span>
            </div>
            <div className="bg-muted h-2 overflow-hidden rounded-full">
              <div className="bg-foreground/80 h-full rounded-full" style={{ width: `${Math.max(row.share * 100, 2)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
/**
 * The portfolio at a glance, like a brokerage account: market value, profit
 * or loss, the 30-day move against the CardMart Index, best and worst card,
 * and how the collection splits by game and grade.
 */
export function PortfolioStats({ stats }: { stats: Stats }) {
  const t = useT();
  if (stats.heldCount === 0) return null;

  const byValue = stats.marketValueThb > 0;
  const share = (r: { count: number; valueThb: number }) =>
    byValue ? r.valueThb / stats.marketValueThb : r.count / stats.heldCount;
  const detail = (r: { count: number; valueThb: number }) =>
    t(r.count === 1 ? "{count} card" : "{count} cards", { count: r.count });

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label={t("Profit / loss")} sub={stats.unrealizedPct != null ? pct(stats.unrealizedPct) : t("Add what you paid on your cards")}>
          <span className={tone(stats.unrealizedThb)}>
            {stats.unrealizedThb == null
              ? "—"
              : `${stats.unrealizedThb > 0 ? "+" : stats.unrealizedThb < 0 ? "−" : ""}${formatThb(Math.abs(stats.unrealizedThb))}`}
          </span>
        </Tile>
        <Tile label={t("Best / worst card")} valueClassName="text-base">
          {stats.best ? (
            <div className="flex flex-col gap-2">
              <Link href={`/item/${stats.best.assetId}`} className="flex min-w-0 items-baseline justify-between gap-2 hover:underline">
                <span className="truncate text-xl font-bold">{stats.best.name}</span>
                <span className={cn("shrink-0 text-xl font-bold", tone(stats.best.gainPct))}>{pct(stats.best.gainPct)}</span>
              </Link>
              {stats.worst && (
                <Link
                  href={`/item/${stats.worst.assetId}`}
                  className="flex min-w-0 items-baseline justify-between gap-2 hover:underline"
                >
                  <span className="truncate text-xl font-bold">{stats.worst.name}</span>
                  <span className={cn("shrink-0 text-xl font-bold", tone(stats.worst.gainPct))}>{pct(stats.worst.gainPct)}</span>
                </Link>
              )}
            </div>
          ) : (
            "—"
          )}
        </Tile>

        <Breakdown
          title={byValue ? t("By game (market value)") : t("By game")}
          rows={stats.byGame.map((g) => ({
            key: g.key,
            label: (
              <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", CARD_GAME_BADGE_CLASS[g.key])}>
                {t(CARD_GAME_LABELS[g.key])}
              </span>
            ),
            share: share(g),
            detail: detail(g),
          }))}
        />
        <Breakdown
          title={byValue ? t("By grade (market value)") : t("By grade")}
          rows={stats.byGrade.map((g) => ({ key: g.key, label: t(g.key), share: share(g), detail: detail(g) }))}
        />
    </section>
  );
}
