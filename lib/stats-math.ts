// Pure price-statistics helpers, shared by the server (lib/stats.ts) and the
// item page's client chart, so both compute every figure the same way.

export interface PricePoint {
  /** Day as epoch ms (midnight UTC). */
  t: number;
  price: number;
}

const DAY = 86_400_000;

/** The last price on or before `t`, or null when the series starts later. */
function priceAt(points: PricePoint[], t: number): number | null {
  let found: number | null = null;
  for (const p of points) {
    if (p.t > t) break;
    found = p.price;
  }
  return found;
}

/** % change from `days` ago to the latest point, or null without a price that far back. */
export function changeOver(points: PricePoint[], days: number): number | null {
  const last = points.at(-1);
  if (!last || points.length < 2) return null;
  const then = priceAt(points, last.t - days * DAY);
  if (then == null || then <= 0) return null;
  return ((last.price - then) / then) * 100;
}

/**
 * % change over the last `days`, or since the first point when the series is
 * younger than that — so a recently tracked card or index still shows a move.
 */
export function changeWithin(points: PricePoint[], days: number): number | null {
  const last = points.at(-1);
  if (!last || points.length < 2) return null;
  const then = priceAt(points, last.t - days * DAY) ?? points[0].price;
  if (then <= 0) return null;
  return ((last.price - then) / then) * 100;
}

export interface PriceStats {
  latest: number | null;
  change7d: number | null;
  change30d: number | null;
  change1y: number | null;
  high: PricePoint | null;
  low: PricePoint | null;
  /** Standard deviation of day-to-day % moves; null with fewer than 3 days. */
  volatility: number | null;
  days: number;
  since: number | null;
}

/** Headline statistics for one price series, oldest point first. */
export function priceStats(points: PricePoint[]): PriceStats {
  const sorted = [...points].sort((a, b) => a.t - b.t);
  let high: PricePoint | null = null;
  let low: PricePoint | null = null;
  for (const p of sorted) {
    if (!high || p.price > high.price) high = p;
    if (!low || p.price < low.price) low = p;
  }
  const moves: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].price;
    if (prev > 0) moves.push(((sorted[i].price - prev) / prev) * 100);
  }
  let volatility: number | null = null;
  if (moves.length >= 2) {
    const mean = moves.reduce((s, m) => s + m, 0) / moves.length;
    volatility = Math.sqrt(moves.reduce((s, m) => s + (m - mean) ** 2, 0) / (moves.length - 1));
  }
  return {
    latest: sorted.at(-1)?.price ?? null,
    change7d: changeOver(sorted, 7),
    change30d: changeOver(sorted, 30),
    change1y: changeOver(sorted, 365),
    high,
    low,
    volatility,
    days: sorted.length,
    since: sorted[0]?.t ?? null,
  };
}

/**
 * An equal-weighted, chain-linked index over several price series, starting
 * at 1,000. Each day moves by the average move of the cards already in it
 * (a card without a new price that day counts as unchanged), and a card only
 * joins from the day after its first price — so a newly tracked card never
 * jumps the index on the day it appears.
 */
export function buildIndex(series: PricePoint[][], base = 1000): PricePoint[] {
  const byDay = new Map<number, Map<number, number>>();
  series.forEach((points, i) => {
    for (const p of points) {
      if (!byDay.has(p.t)) byDay.set(p.t, new Map());
      byDay.get(p.t)!.set(i, p.price);
    }
  });
  const days = [...byDay.keys()].sort((a, b) => a - b);
  const last = new Map<number, number>();
  const out: PricePoint[] = [];
  let level = base;
  for (const day of days) {
    const today = byDay.get(day)!;
    const ratios: number[] = [];
    for (const [i, prev] of last) {
      const now = today.get(i) ?? prev;
      if (prev > 0) ratios.push(now / prev);
    }
    if (ratios.length > 0) level *= ratios.reduce((s, r) => s + r, 0) / ratios.length;
    for (const [i, price] of today) last.set(i, price);
    out.push({ t: day, price: Math.round(level * 10) / 10 });
  }
  return out;
}
