"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Activity, LayoutGrid, TrendingDown, TrendingUp } from "lucide-react";

import { CardArt } from "@/components/asset/card-art";
import { MarketHeatmap } from "@/components/marketplace/market-heatmap";
import { formatGrade, formatThb } from "@/lib/format";
import type { LeaderboardPeriod, LeaderboardRow } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useT } from "@/components/landing/language-provider";

type View = "movers" | "heatmap";

const PERIODS: LeaderboardPeriod[] = ["24h", "7d", "30d"];
const MOVERS_SHOWN = 3;
/** Smaller changes than this are rounding noise, not a move. */
const MIN_MOVE_PCT = 0.05;

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: typeof Activity }[];
}) {
  return (
    <div className="bg-card flex shrink-0 rounded-lg border p-0.5 text-xs font-medium">
      {options.map(({ value: v, label, icon: Icon }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 whitespace-nowrap transition-colors",
            value === v ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {Icon && <Icon className="size-3.5" />}
          {label}
        </button>
      ))}
    </div>
  );
}

function Thumb({ row }: { row: LeaderboardRow }) {
  return (
    <span className="card-stage relative block aspect-[3/4] w-8 shrink-0 overflow-hidden rounded-md border">
      {row.photoUrl ? (
        <Image src={row.photoUrl} alt="" fill sizes="32px" className="object-contain p-0.5" />
      ) : (
        <CardArt
          themeIndex={row.themeIndex}
          category={row.category}
          gradingCompany={row.gradingCompany}
          grade={row.grade}
          isBlackLabel={row.isBlackLabel}
          bordered={false}
          showGrade={false}
        />
      )}
    </span>
  );
}

/** One ranked list — top gainers or top losers for the chosen period. */
function MoversList({
  title,
  icon: Icon,
  tone,
  rows,
  period,
}: {
  title: string;
  icon: typeof TrendingUp;
  tone: "up" | "down";
  rows: LeaderboardRow[];
  period: LeaderboardPeriod;
}) {
  const t = useT();
  return (
    <section className="bg-card flex min-w-0 flex-col self-start rounded-2xl border">
      <h3 className="eyebrow text-muted-foreground flex items-center gap-2 border-b px-4 py-2.5">
        <Icon className={cn("size-3.5", tone === "up" ? "text-success" : "text-destructive")} />
        {t(title)}
      </h3>
      {rows.length === 0 ? (
        <p className="text-muted-foreground px-4 py-5 text-center text-sm">{t("No price moves in this period yet.")}</p>
      ) : (
        <ol className="divide-y">
          {rows.map((row) => {
            const change = row.change[period]!;
            return (
              <li key={row.id}>
                <Link href={`/item/${row.id}`} className="hover:bg-secondary/60 flex items-center gap-3 px-4 py-2 transition-colors">
                  <Thumb row={row} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{row.name}</span>
                    <span className="text-muted-foreground truncate text-xs">
                      {row.gradingCompany === "RAW" ? t("Raw") : `${row.gradingCompany} ${formatGrade(row.grade)}`} ·{" "}
                      <span className="tabular-nums">{formatThb(row.priceThb)}</span>
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-sm font-semibold tabular-nums",
                      change > 0 ? "text-success" : "text-destructive",
                    )}
                  >
                    {change > 0 ? "▲" : "▼"} {Math.abs(change).toFixed(1)}%
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/**
 * The market at a glance, above the Market page's grid: the biggest price
 * movers, or a heatmap of every card for sale. Built from real price
 * snapshots. Stats, activity and set releases live on Community → News.
 */
export function MarketPulse({ rows }: { rows: LeaderboardRow[] }) {
  const [view, setView] = useState<View>("movers");
  // Open on the first period that actually has price moves, so the panel
  // never starts as two empty lists while older moves exist.
  const [period, setPeriod] = useState<LeaderboardPeriod>(
    () => (["7d", "30d", "24h"] as const).find((p) => rows.some((r) => Math.abs(r.change[p] ?? 0) >= MIN_MOVE_PCT)) ?? "7d",
  );
  const t = useT();

  const moved = rows.filter((r) => r.change[period] != null && Math.abs(r.change[period]!) >= MIN_MOVE_PCT);
  const gainers = moved
    .filter((r) => r.change[period]! > 0)
    .sort((a, b) => b.change[period]! - a.change[period]!)
    .slice(0, MOVERS_SHOWN);
  const losers = moved
    .filter((r) => r.change[period]! < 0)
    .sort((a, b) => a.change[period]! - b.change[period]!)
    .slice(0, MOVERS_SHOWN);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="bg-secondary text-foreground flex size-7 items-center justify-center rounded-md">
            <Activity className="size-3.5" />
          </div>
          <h2 className="eyebrow text-foreground text-sm">{t("Market pulse")}</h2>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {view === "movers" && (
            <Segmented value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p, label: p }))} />
          )}
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "movers", label: t("Movers"), icon: TrendingUp },
              { value: "heatmap", label: t("Heatmap"), icon: LayoutGrid },
            ]}
          />
        </div>
      </div>

      {view === "movers" ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <MoversList title="Top gainers" icon={TrendingUp} tone="up" rows={gainers} period={period} />
          <MoversList title="Top losers" icon={TrendingDown} tone="down" rows={losers} period={period} />
        </div>
      ) : (
        <MarketHeatmap rows={rows} compact />
      )}
    </section>
  );
}
