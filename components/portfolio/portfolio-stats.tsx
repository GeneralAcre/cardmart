"use client";

import { GameIcon } from "@/components/ui/game-icon";
import Link from "next/link";

import { useMoney } from "@/components/currency-provider";
import { CARD_GAME_COLOR, CARD_GAME_LABELS } from "@/lib/labels";
import type { PortfolioStats as Stats } from "@/lib/stats";
import { cn } from "@/lib/utils";
import { useT } from "@/components/landing/language-provider";
import { PortfolioValueChart } from "@/components/portfolio/portfolio-value-chart";

const tone = (v: number | null) =>
  v == null || Math.abs(v) < 0.05 ? "text-muted-foreground" : v > 0 ? "text-success" : "text-destructive";
const pct = (v: number | null) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`);

// Slice colours: the green-to-yellow palette from the high grade down, so the
// best grades are the brightest. Black Label and ungraded get their own.
const GRADE_PALETTE = ["#FFFF3F", "#EEEF20", "#D4D700", "#AACC00", "#80B918", "#55A630", "#2B9348", "#007F5F"];
const BLACK_LABEL_COLOR = "#1c1c1f";
const UNGRADED_COLOR = "#9aa5a0";

function gradeLabel(key: string, t: (s: string) => string) {
  return key.startsWith("Grade ") ? `${t("Grade")} ${key.slice(6)}` : t(key);
}

type Slice = { key: string; label: React.ReactNode; share: number; color: string };

/** The score colours spread across the whole palette (not just its first few shades), so neighbouring slices are easy to tell apart even with only two or three grades. */
function gradeSlices(rows: { key: string; share: number }[], t: (s: string) => string): Slice[] {
  const scores = rows.filter((r) => r.key !== "Black Label" && r.key !== "Ungraded");
  return rows.map((row) => {
    const rank = scores.findIndex((r) => r.key === row.key);
    const paletteIndex = scores.length > 1 ? Math.round((rank * (GRADE_PALETTE.length - 1)) / (scores.length - 1)) : 0;
    return {
      ...row,
      label: gradeLabel(row.key, t),
      color: row.key === "Black Label" ? BLACK_LABEL_COLOR : row.key === "Ungraded" ? UNGRADED_COLOR : GRADE_PALETTE[paletteIndex],
    };
  });
}

/** A share-of-the-whole as one thin stacked bar, with its key underneath. Used for both the games and the grades. */
function ShareBar({ title, slices }: { title: string; slices: Slice[] }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <h3 className="text-muted-foreground text-sm font-medium">{title}</h3>
      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full">
        {slices.map((s) => (
          <span key={s.key} className="h-full" style={{ width: `${s.share * 100}%`, backgroundColor: s.color }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {slices.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5 text-sm">
            <span className="size-2.5 shrink-0 rounded-full border border-black/15" style={{ backgroundColor: s.color }} />
            <span className="flex items-center gap-1">{s.label}</span>
            <span className="font-semibold tabular-nums">{Math.round(s.share * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The portfolio at a glance, like a brokerage account: profit or loss first
 * and biggest, then market value, the 30-day move against the CardMart
 * Index and a small trend line; then best and worst card, and how the
 * collection splits by game and grade.
 */
export function PortfolioStats({
  stats,
  history,
}: {
  stats: Stats;
  /** Saved portfolio values over time, for the trend line beside the profit. */
  history: { totalThb: number; createdAt: string }[];
}) {
  const money = useMoney();
  const t = useT();
  if (stats.heldCount === 0) return null;

  const byValue = stats.marketValueThb > 0;
  const share = (r: { count: number; valueThb: number }) =>
    byValue ? r.valueThb / stats.marketValueThb : r.count / stats.heldCount;
  const gain = stats.unrealizedThb;
  return (
    <section>
      <div className="grid gap-3 lg:grid-cols-3">
        {/* What matters most first: what the cards are worth and how much
            you're up or down, both big, side by side (profit on the right);
            then the 30-day move, and a small trend line along the bottom. */}
        <div className="bg-card flex min-w-0 flex-col gap-5 rounded-xl border p-5 sm:p-6 lg:col-span-2">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-muted-foreground text-sm font-medium">{t("Portfolio value")}</span>
                <span className="text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">
                  {byValue ? money(stats.marketValueThb) : "—"}
                </span>
              </div>
              <div className="flex min-w-0 flex-col gap-1 sm:items-end sm:text-right">
                <span className="text-muted-foreground text-sm font-medium">{t("Profit / loss")}</span>
                {/* The amount and its percentage, the same size. */}
                <div className={cn("flex flex-wrap items-baseline gap-x-2 text-2xl font-bold tracking-tight tabular-nums sm:justify-end sm:text-3xl", tone(gain))}>
                  <span>{gain == null ? "—" : `${gain > 0 ? "+" : gain < 0 ? "−" : ""}${money(Math.abs(gain))}`}</span>
                  {stats.unrealizedPct != null && <span>({pct(stats.unrealizedPct)})</span>}
                </div>
              </div>
            </div>
            <dl className="flex flex-wrap gap-x-8 gap-y-2">
              <div className="flex items-baseline gap-2">
                <dt className="text-muted-foreground text-sm">{t("Last 30 days")}</dt>
                <dd className={cn("text-lg font-semibold tabular-nums", tone(stats.change30d))}>{pct(stats.change30d)}</dd>
              </div>
              {stats.index30d != null && (
                <div className="flex items-baseline gap-2">
                  <dt className="text-muted-foreground text-sm">{t("CardMart Index")}</dt>
                  <dd className={cn("text-lg font-semibold tabular-nums", tone(stats.index30d))}>{pct(stats.index30d)}</dd>
                </div>
              )}
            </dl>
          </div>
          <div className="border-t pt-4">
            <PortfolioValueChart initialHistory={history} />
          </div>
        </div>

        {/* Right column: best and worst card, then how the collection splits. */}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="bg-card flex min-w-0 flex-col divide-y rounded-xl border">
            {stats.best ? (
              [
                { label: t("Best card"), card: stats.best },
                ...(stats.worst ? [{ label: t("Worst card"), card: stats.worst }] : []),
              ].map(({ label, card }) => (
                <Link
                  key={label}
                  href={`/item/${card.assetId}`}
                  className="hover:bg-accent/50 flex min-w-0 flex-col gap-0.5 px-5 py-4 transition-colors first:rounded-t-xl last:rounded-b-xl"
                >
                  <span className="text-muted-foreground text-sm font-medium">{label}</span>
                  <span className="flex min-w-0 items-baseline justify-between gap-3">
                    <span className="truncate text-base font-bold">{card.name}</span>
                    <span className={cn("shrink-0 text-xl font-bold tabular-nums", tone(card.gainPct))}>{pct(card.gainPct)}</span>
                  </span>
                </Link>
              ))
            ) : (
              <div className="flex flex-col gap-0.5 px-5 py-4">
                <span className="text-muted-foreground text-sm font-medium">{t("Best / worst card")}</span>
                <span className="text-base font-bold">—</span>
              </div>
            )}
          </div>

          <div className="bg-card flex min-w-0 flex-1 flex-col justify-center gap-5 rounded-xl border px-5 py-4">
            <ShareBar
              title={byValue ? t("By game (market value)") : t("By game")}
              slices={stats.byGame.map((g) => ({
                key: g.key,
                label: (
                  <>
                    <GameIcon game={g.key} size={14} />
                    {t(CARD_GAME_LABELS[g.key])}
                  </>
                ),
                share: share(g),
                color: CARD_GAME_COLOR[g.key],
              }))}
            />
            <ShareBar
              title={byValue ? t("By grade (market value)") : t("By grade")}
              slices={gradeSlices(stats.byGrade.map((g) => ({ key: g.key, share: share(g) })), t)}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
