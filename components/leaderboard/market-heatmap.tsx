"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, LayoutGrid } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatGrade, formatThb } from "@/lib/format";
import type { LeaderboardPeriod, LeaderboardRow } from "@/lib/queries";
import { cn } from "@/lib/utils";

type Group = "series" | "cards";
type SizeBy = "mcap" | "avg";

interface Tile {
  key: string;
  label: string;
  sublabel: string;
  /** Tile area. */
  size: number;
  /** Value-weighted % change over the period, or null with no earlier price to compare. */
  change: number | null;
  mcapThb: number;
  count: number;
  href?: string;
  series?: string;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const PERIODS: LeaderboardPeriod[] = ["24h", "7d", "30d"];
/** Change at which a tile reaches full colour; anything bigger is capped. */
const FULL_COLOR_PCT = 20;

function kThb(v: number) {
  if (v >= 1_000_000) return `THB ${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`;
  if (v >= 1_000) return `THB ${(v / 1_000).toFixed(0)}K`;
  return formatThb(v);
}

/**
 * Value-weighted change for a set of cards: (today's total − the total at the
 * start of the period) / the start total, using only cards that have an
 * earlier price to compare. One expensive card moving counts for more than a
 * cheap one — the same idea as a market-cap-weighted index.
 */
function weightedChange(rows: LeaderboardRow[], period: LeaderboardPeriod): number | null {
  let now = 0;
  let before = 0;
  for (const r of rows) {
    const c = r.change[period];
    if (c == null) continue;
    now += r.priceThb;
    before += r.priceThb / (1 + c / 100);
  }
  return before > 0 ? ((now - before) / before) * 100 : null;
}

/** Squarified treemap (Bruls, Huizing & van Wijk) — keeps tiles as close to square as possible. */
function squarify(values: number[], rect: Rect): Rect[] {
  const total = values.reduce((a, b) => a + b, 0);
  if (total <= 0 || rect.w <= 0 || rect.h <= 0) return values.map(() => ({ x: 0, y: 0, w: 0, h: 0 }));
  const scale = (rect.w * rect.h) / total;
  const areas = values.map((v) => v * scale);
  const out: Rect[] = [];
  let { x, y, w, h } = rect;
  let i = 0;

  const worst = (row: number[], side: number) => {
    const sum = row.reduce((a, b) => a + b, 0);
    const max = Math.max(...row);
    const min = Math.min(...row);
    return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
  };

  while (i < areas.length) {
    const side = Math.min(w, h);
    const row = [areas[i]];
    let j = i + 1;
    while (j < areas.length && worst([...row, areas[j]], side) <= worst(row, side)) {
      row.push(areas[j]);
      j++;
    }
    const rowArea = row.reduce((a, b) => a + b, 0);
    if (w >= h) {
      const colW = rowArea / h;
      let yy = y;
      for (const a of row) {
        out.push({ x, y: yy, w: colW, h: a / colW });
        yy += a / colW;
      }
      x += colW;
      w -= colW;
    } else {
      const rowH = rowArea / w;
      let xx = x;
      for (const a of row) {
        out.push({ x: xx, y, w: a / rowH, h: rowH });
        xx += a / rowH;
      }
      y += rowH;
      h -= rowH;
    }
    i = j;
  }
  return out;
}

function tileStyle(change: number | null): { background: string; dark: boolean } {
  if (change == null || Math.abs(change) < 0.005) return { background: "var(--muted)", dark: false };
  const strength = Math.min(Math.abs(change) / FULL_COLOR_PCT, 1);
  const pct = Math.round(30 + strength * 70);
  const color = change > 0 ? "var(--success)" : "var(--destructive)";
  return {
    background: `color-mix(in oklab, ${color} ${pct}%, var(--muted))`,
    // Lime is light — past ~60% it needs dark text to stay readable.
    dark: change > 0 && pct >= 60,
  };
}

function formatChange(change: number | null) {
  if (change == null) return "—";
  return `${change > 0 ? "+" : ""}${change.toFixed(2)}%`;
}

export function MarketHeatmap({ rows }: { rows: LeaderboardRow[] }) {
  const router = useRouter();
  const [period, setPeriod] = useState<LeaderboardPeriod>("7d");
  const [group, setGroup] = useState<Group>("series");
  const [sizeBy, setSizeBy] = useState<SizeBy>("mcap");
  const [series, setSeries] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const height = width < 640 ? 440 : 580;

  const tiles: Tile[] = useMemo(() => {
    const cardTiles = (list: LeaderboardRow[]): Tile[] =>
      list.map((r) => ({
        key: r.id,
        label: r.name,
        sublabel: r.gradingCompany === "RAW" ? "Raw" : `${r.gradingCompany} ${formatGrade(r.grade)}${r.isBlackLabel ? " BL" : ""}`,
        size: r.priceThb,
        change: r.change[period],
        mcapThb: r.priceThb,
        count: 1,
        href: `/item/${r.id}`,
      }));

    if (series != null) return cardTiles(rows.filter((r) => r.subtitle === series));
    if (group === "cards") return cardTiles(rows);

    const bySeries = new Map<string, LeaderboardRow[]>();
    for (const r of rows) bySeries.set(r.subtitle, [...(bySeries.get(r.subtitle) ?? []), r]);
    return [...bySeries.entries()].map(([name, list]) => {
      const mcap = list.reduce((a, r) => a + r.priceThb, 0);
      return {
        key: name,
        label: name,
        sublabel: `${list.length} card${list.length === 1 ? "" : "s"}`,
        size: sizeBy === "mcap" ? mcap : mcap / list.length,
        change: weightedChange(list, period),
        mcapThb: mcap,
        count: list.length,
        series: name,
      };
    });
  }, [rows, period, group, sizeBy, series]);

  const sorted = useMemo(() => [...tiles].filter((t) => t.size > 0).sort((a, b) => b.size - a.size), [tiles]);
  const rects = useMemo(() => squarify(sorted.map((t) => t.size), { x: 0, y: 0, w: width, h: height }), [sorted, width, height]);

  const ranked = [...tiles].filter((t) => t.change != null).sort((a, b) => b.change! - a.change!);
  const best = ranked[0];
  const worst = ranked.length > 1 ? ranked[ranked.length - 1] : null;
  const biggest = sorted[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {series != null ? (
            <Button variant="outline" size="sm" onClick={() => setSeries(null)}>
              <ChevronLeft /> All series
            </Button>
          ) : (
            <Segmented
              value={group}
              onChange={(v) => setGroup(v as Group)}
              options={[
                { value: "series", label: "By series" },
                { value: "cards", label: "By card" },
              ]}
            />
          )}
          {series == null && group === "series" && (
            <Segmented
              value={sizeBy}
              onChange={(v) => setSizeBy(v as SizeBy)}
              options={[
                { value: "mcap", label: "Market cap" },
                { value: "avg", label: "Avg price" },
              ]}
            />
          )}
          {series != null && <span className="truncate text-sm font-semibold">{series}</span>}
        </div>
        <Segmented value={period} onChange={(v) => setPeriod(v as LeaderboardPeriod)} options={PERIODS.map((p) => ({ value: p, label: p }))} />
      </div>

      {tiles.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label={`Top gainer · ${period}`} tile={best && best.change! > 0 ? best : null} />
          <Stat label={`Top loser · ${period}`} tile={worst && worst.change! < 0 ? worst : null} />
          <Stat label="Largest market cap" tile={biggest ?? null} showMcap />
        </div>
      )}

      <div ref={containerRef} className="relative w-full overflow-hidden rounded-xl border" style={{ height }}>
        {sorted.length === 0 ? (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 text-sm">
            <LayoutGrid className="size-6" />
            No cards for sale yet.
          </div>
        ) : (
          width > 0 &&
          sorted.map((t, i) => {
            const r = rects[i];
            const { background, dark } = tileStyle(t.change);
            const big = r.w > 110 && r.h > 64;
            const medium = r.w > 64 && r.h > 36;
            const clickable = Boolean(t.href || t.series);
            return (
              <button
                key={t.key}
                type="button"
                disabled={!clickable}
                onClick={() => (t.series ? setSeries(t.series) : t.href && router.push(t.href))}
                title={`${t.label} · ${t.sublabel}\n${formatChange(t.change)} (${period}) · market cap ${formatThb(t.mcapThb)}`}
                className={cn(
                  "absolute flex flex-col items-center justify-center overflow-hidden border border-black/40 p-1 text-center transition-[filter] hover:brightness-110",
                  dark ? "text-neutral-950" : "text-white",
                )}
                style={{ left: r.x, top: r.y, width: r.w, height: r.h, background }}
              >
                {medium && (
                  <span className={cn("line-clamp-2 leading-tight font-semibold", big ? "text-sm" : "text-[11px]")}>
                    {t.label}
                  </span>
                )}
                {medium && (
                  <span className={cn("font-bold tabular-nums", big ? "text-base" : "text-[11px]")}>
                    {formatChange(t.change)}
                  </span>
                )}
                {big && (
                  <span className="text-[11px] opacity-80">
                    {t.sublabel} · {kThb(t.mcapThb)}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>

      <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-3 text-[11px]">
        <div className="flex items-center gap-2">
          <span>−{FULL_COLOR_PCT}%</span>
          <div
            className="h-2 w-40 rounded-full"
            style={{
              background:
                "linear-gradient(to right, var(--destructive), color-mix(in oklab, var(--destructive) 30%, var(--muted)), var(--muted), color-mix(in oklab, var(--success) 30%, var(--muted)), var(--success))",
            }}
          />
          <span>+{FULL_COLOR_PCT}%</span>
        </div>
        <p className="max-w-xl">
          {series == null && group === "series"
            ? "Each tile is a card series (set). Size = total value listed (market cap) or average price; colour = value-weighted price change. Click a series to see its cards."
            : "Each tile is a card for sale. Size = asking price; colour = price change. Click a card to open it."}
        </p>
      </div>
    </div>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="bg-muted flex shrink-0 rounded-lg p-0.5 text-xs font-medium">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            "rounded-md px-2.5 py-1.5 whitespace-nowrap transition-colors",
            value === o.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Stat({ label, tile, showMcap }: { label: string; tile: Tile | null; showMcap?: boolean }) {
  return (
    <div className="bg-card flex min-w-0 flex-col gap-1 rounded-xl border p-3">
      <span className="text-muted-foreground text-xs">{label}</span>
      {tile ? (
        <>
          <span className="truncate text-sm font-semibold">{tile.label}</span>
          <span
            className={cn(
              "text-sm font-bold tabular-nums",
              showMcap ? "" : tile.change! > 0 ? "text-success" : "text-destructive",
            )}
          >
            {showMcap ? formatThb(tile.mcapThb) : formatChange(tile.change)}
          </span>
        </>
      ) : (
        <span className="text-muted-foreground text-sm">—</span>
      )}
    </div>
  );
}
