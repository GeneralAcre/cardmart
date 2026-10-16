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

function Tile({ label, children, sub }: { label: string; children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="bg-card flex min-w-0 flex-col gap-0.5 p-4">
      <span className="text-muted-foreground text-xs">{label}</span>
      <div className="text-xl font-bold tabular-nums">{children}</div>
      {sub && <div className="text-muted-foreground truncate text-[11px]">{sub}</div>}
    </div>
  );
}

/** One breakdown row: label, share bar and share. Value-weighted, or by count when nothing is priced. */
function Breakdown({ title, rows }: { title: string; rows: { label: React.ReactNode; key: string; share: number; detail: string }[] }) {
  return (
    <div className="bg-card flex flex-col gap-3 rounded-xl border p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="flex flex-col gap-2.5">
        {rows.map((row) => (
          <li key={row.key} className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span>{row.label}</span>
              <span className="text-muted-foreground tabular-nums">
                {row.detail} · {Math.round(row.share * 100)}%
              </span>
            </div>
            <div className="bg-muted h-1.5 overflow-hidden rounded-full">
              <div className="bg-foreground/70 h-full rounded-full" style={{ width: `${Math.max(row.share * 100, 2)}%` }} />
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
    byValue ? formatThb(r.valueThb) : t(r.count === 1 ? "{count} card" : "{count} cards", { count: r.count });
  const beat = stats.change30d != null && stats.index30d != null ? stats.change30d - stats.index30d : null;

  return (
    <section className="flex flex-col gap-3">
      <div className="bg-border grid grid-cols-2 gap-px overflow-hidden rounded-xl border lg:grid-cols-4">
        <Tile
          label={t("Market value")}
          sub={t("{priced} of {held} cards have a market price", { priced: stats.pricedCount, held: stats.heldCount })}
        >
          {stats.pricedCount > 0 ? formatThb(stats.marketValueThb) : "—"}
        </Tile>
        <Tile label={t("Profit / loss")} sub={stats.unrealizedPct != null ? pct(stats.unrealizedPct) : t("Add what you paid on your cards")}>
          <span className={tone(stats.unrealizedThb)}>
            {stats.unrealizedThb == null
              ? "—"
              : `${stats.unrealizedThb > 0 ? "+" : stats.unrealizedThb < 0 ? "−" : ""}${formatThb(Math.abs(stats.unrealizedThb))}`}
          </span>
        </Tile>
        <Tile
          label={t("30 days vs market")}
          sub={
            beat != null
              ? t(beat >= 0 ? "Beating the CardMart Index by {pts} pts" : "Behind the CardMart Index by {pts} pts", {
                  pts: Math.abs(beat).toFixed(1),
                })
              : t("CardMart Index {pct}", { pct: pct(stats.index30d) })
          }
        >
          <span className={tone(stats.change30d)}>{pct(stats.change30d)}</span>
        </Tile>
        <Tile
          label={t("Best / worst card")}
          sub={stats.worst ? `${stats.worst.name} ${pct(stats.worst.gainPct)}` : undefined}
        >
          {stats.best ? (
            <Link href={`/item/${stats.best.assetId}`} className="flex min-w-0 items-baseline gap-2 hover:underline">
              <span className="truncate text-sm font-semibold">{stats.best.name}</span>
              <span className={cn("text-sm", tone(stats.best.gainPct))}>{pct(stats.best.gainPct)}</span>
            </Link>
          ) : (
            "—"
          )}
        </Tile>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
      </div>
    </section>
  );
}
