import type { LeaderboardPeriod } from "@prisma/client";

// Leaderboard time windows, all in UTC. DAILY is a rolling 24 hours; WEEKLY
// resets every Sunday at 00:00; MONTHLY on the 1st; ALL_TIME never resets.

const DAY = 86_400_000;
const EPOCH = new Date(0);

export interface Window {
  period: LeaderboardPeriod;
  /** The stored key for this window: the start of the week/month, the epoch for ALL_TIME, today 00:00 for DAILY. */
  periodStart: Date;
  /** Sales released at or after this count. */
  from: Date;
  /** Sales released before this count. */
  to: Date;
}

const startOfUtcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const startOfUtcWeek = (d: Date) => new Date(startOfUtcDay(d).getTime() - d.getUTCDay() * DAY); // Sunday
const startOfUtcMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

/** The window that contains `now`. */
export function currentWindow(period: LeaderboardPeriod, now = new Date()): Window {
  // Windows are half-open [from, to); a live window includes this very moment.
  const to = new Date(now.getTime() + 1);
  switch (period) {
    case "DAILY":
      // Rolling: the last 24 hours, keyed by today so each day keeps one board.
      return { period, periodStart: startOfUtcDay(now), from: new Date(now.getTime() - DAY), to };
    case "WEEKLY": {
      const start = startOfUtcWeek(now);
      return { period, periodStart: start, from: start, to };
    }
    case "MONTHLY": {
      const start = startOfUtcMonth(now);
      return { period, periodStart: start, from: start, to };
    }
    case "ALL_TIME":
      return { period, periodStart: EPOCH, from: EPOCH, to };
  }
}

/** The last fully finished week or month, for awarding badges. */
export function previousWindow(period: "WEEKLY" | "MONTHLY", now = new Date()): Window {
  if (period === "WEEKLY") {
    const end = startOfUtcWeek(now);
    const start = new Date(end.getTime() - 7 * DAY);
    return { period, periodStart: start, from: start, to: end };
  }
  const end = startOfUtcMonth(now);
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, 1));
  return { period, periodStart: start, from: start, to: end };
}

export const PERIODS: LeaderboardPeriod[] = ["DAILY", "WEEKLY", "MONTHLY", "ALL_TIME"];
