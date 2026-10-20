"use client";

import { GameIcon } from "@/components/ui/game-icon";
import { Cell, Pie, PieChart } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import Link from "next/link";

import { formatThb } from "@/lib/format";
import { CARD_GAME_COLOR, CARD_GAME_LABELS } from "@/lib/labels";
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
    <div className="bg-card flex min-w-0 flex-col gap-1 rounded-xl border p-4 sm:gap-1.5 sm:p-5">
      <span className="text-muted-foreground text-xs leading-tight font-medium sm:text-sm">{label}</span>
      <div className={cn("font-bold tracking-tight tabular-nums", valueClassName)}>{children}</div>
      {sub && <div className="text-muted-foreground text-xs leading-tight sm:text-sm">{sub}</div>}
    </div>
  );
}


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

/** A share-of-the-whole donut with its key underneath (side by side on wide screens). Used for both the games and the grades. */
function Donut({ title, slices }: { title: string; slices: Slice[] }) {
  return (
    <div className="bg-card flex min-w-0 flex-col gap-3 rounded-xl border p-4 sm:gap-4 sm:p-5">
      <h3 className="text-muted-foreground text-xs leading-tight font-medium sm:text-sm">{title}</h3>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-4">
        <ChartContainer config={{}} className="mx-auto aspect-square size-28 shrink-0 sm:size-32 xl:mx-0 xl:size-28">
          <PieChart>
            <Pie
              data={slices}
              dataKey="share"
              nameKey="key"
              innerRadius="58%"
              outerRadius="100%"
              paddingAngle={slices.length > 1 ? 2 : 0}
              stroke="var(--card)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {slices.map((s) => (
                <Cell key={s.key} fill={s.color} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <ul className="flex min-w-0 flex-col gap-1.5 xl:flex-1">
          {slices.map((s) => (
            <li key={s.key} className="flex items-center gap-2 text-xs sm:text-sm">
              <span className="size-2.5 shrink-0 rounded-full border border-black/15" style={{ backgroundColor: s.color }} />
              <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate">{s.label}</span>
              <span className="text-foreground shrink-0 font-semibold tabular-nums">{Math.round(s.share * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>
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
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label={t("Profit / loss")} valueClassName="text-2xl sm:text-3xl">
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
                <span className="truncate text-base font-bold sm:text-xl">{stats.best.name}</span>
                <span className={cn("shrink-0 text-base font-bold sm:text-xl", tone(stats.best.gainPct))}>{pct(stats.best.gainPct)}</span>
              </Link>
              {stats.worst && (
                <Link
                  href={`/item/${stats.worst.assetId}`}
                  className="flex min-w-0 items-baseline justify-between gap-2 hover:underline"
                >
                  <span className="truncate text-base font-bold sm:text-xl">{stats.worst.name}</span>
                  <span className={cn("shrink-0 text-base font-bold sm:text-xl", tone(stats.worst.gainPct))}>{pct(stats.worst.gainPct)}</span>
                </Link>
              )}
            </div>
          ) : (
            "—"
          )}
        </Tile>

        <Donut
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
        <Donut
          title={byValue ? t("By grade (market value)") : t("By grade")}
          slices={gradeSlices(stats.byGrade.map((g) => ({ key: g.key, share: share(g) })), t)}
        />
    </section>
  );
}
