"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Flame, Handshake, Info, Layers, TrendingUp, Trophy, type LucideIcon } from "lucide-react";

import { UserAvatar, displayNameOf } from "@/components/messages/user-avatar";
import { useMoney } from "@/components/currency-provider";
import type { TraderRow } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useT } from "@/components/landing/language-provider";

function toneOf(n: number | null) {
  if (n == null || n === 0) return "text-muted-foreground";
  return n > 0 ? "text-success" : "text-destructive";
}

function Gain({ thb, pct, className }: { thb: number | null; pct?: number | null; className?: string }) {
  const money = useMoney();
  if (thb == null) return <span className={cn("text-muted-foreground", className)}>—</span>;
  return (
    <span className={cn("tabular-nums", toneOf(thb), className)}>
      {thb > 0 ? "+" : thb < 0 ? "−" : ""}
      {money(Math.abs(thb))}
      {pct != null && <span className="ml-1 text-xs">({pct > 0 ? "+" : ""}{pct.toFixed(1)}%)</span>}
    </span>
  );
}

function Pct({ pct, className }: { pct: number | null; className?: string }) {
  if (pct == null) return null;
  return (
    <span className={cn("tabular-nums", toneOf(pct), className)}>
      {pct > 0 ? "+" : ""}
      {pct.toFixed(1)}%
    </span>
  );
}

// Gold / silver / bronze: the top-three rank numbers in each board and the
// top-edge glow on "Your standing".
const MEDAL = [
  { text: "text-medal-gold", line: "via-medal-gold", ring: "ring-medal-gold/60" },
  { text: "text-medal-silver", line: "via-medal-silver", ring: "ring-medal-silver/40" },
  { text: "text-medal-bronze", line: "via-medal-bronze", ring: "ring-medal-bronze/40" },
];

// The oversized, barely-there rank number behind the "Your standing" card.
function Watermark({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "text-foreground/[0.04] pointer-events-none absolute font-black leading-none tracking-tighter tabular-nums select-none",
        className,
      )}
    >
      {children}
    </span>
  );
}

type Me = { id: string; name: string | null; handle: string | null; image: string | null };

// The viewer's rank in one category board (null = not on that board yet).
type MyRank = { label: string; title: string; icon: LucideIcon; rank: number | null };

function YourStanding({ me, rows, ranks }: { me: Me; rows: TraderRow[]; ranks: MyRank[] }) {
  const money = useMoney();
  const t = useT();
  const idx = rows.findIndex((r) => r.userId === me.id);
  const row = idx >= 0 ? rows[idx] : null;

  // Not on the board yet: a slim prompt, so the leaderboard stays the focus.
  if (!row) {
    return (
      <section className="bg-card flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar user={me} className="size-11 shrink-0" />
          <div className="flex min-w-0 flex-col">
            <span className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium tracking-[0.2em] uppercase">
              <Trophy className="size-3.5" />
              {t("Your standing")}
            </span>
            <span className="truncate text-lg font-semibold">{me.handle ? `@${me.handle}` : displayNameOf(me)}</span>
          </div>
        </div>
        <span className="text-sm font-medium text-medal-gold sm:text-right">{t("Buy a card to get on the board")}</span>
      </section>
    );
  }

  const rank = idx + 1;
  const ahead = idx > 0 ? rows[idx - 1] : null;

  return (
    <section className="bg-card relative overflow-hidden rounded-2xl border">
      <Watermark className="-right-3 -bottom-6 text-[7rem] sm:-right-4 sm:-bottom-10 sm:text-[12rem]">{rank}</Watermark>
      <div className="relative flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
        <div className="flex flex-col gap-1 sm:border-r sm:pr-6">
          <span className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium tracking-[0.2em] uppercase">
            <Trophy className="size-3.5" />
            {t("Your standing")}
          </span>
          <span className="text-4xl font-bold tracking-tight tabular-nums sm:text-5xl">{`#${rank}`}</span>
          <span className="text-muted-foreground text-[11px] tracking-[0.15em] uppercase">{t("Overall")}</span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex min-w-0 items-center gap-4">
            <UserAvatar user={me} className="size-12 text-sm sm:size-14 sm:text-base" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-xl font-semibold">{me.handle ? `@${me.handle}` : displayNameOf(me)}</span>
              <span className="truncate text-sm font-medium text-medal-gold">
                {ahead
                  ? t("{amount} to #{rank}", { amount: money(Math.max(0, ahead.totalGainThb - row.totalGainThb)), rank: rank - 1 })
                  : t("Top of the board")}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {ranks.map((c) => {
              const Icon = c.icon;
              const medal = c.rank && c.rank <= 3 ? MEDAL[c.rank - 1] : null;
              return (
                <span
                  key={c.label}
                  title={c.title}
                  className="bg-background/40 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
                >
                  <Icon className={cn("size-3.5", medal ? medal.text : "text-muted-foreground")} />
                  <span className="text-muted-foreground">{c.label}</span>
                  <span className={cn("font-semibold tabular-nums", medal && medal.text)}>{c.rank ? `#${c.rank}` : "—"}</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// One category board: a header chip and a ranked top-ten, after the Premier
// League "player stats" layout the user asked for.
type Board = {
  title: string;
  icon: LucideIcon;
  data: TraderRow[];
  value: (r: TraderRow) => ReactNode;
  empty: string;
};

function CategoryBoard({ title, icon: Icon, data, value, empty }: Board) {
  return (
    <section className="bg-card flex h-full flex-col overflow-hidden rounded-2xl border">
      <div className="flex items-center gap-2.5 border-b px-4 py-3.5">
        <div className="bg-foreground text-background flex size-8 items-center justify-center rounded-lg">
          <Icon className="size-4" />
        </div>
        <h2 className="text-[15px] font-semibold">{title}</h2>
      </div>
      {data.length === 0 ? (
        <p className="text-muted-foreground flex flex-1 items-center justify-center px-4 py-10 text-center text-sm">{empty}</p>
      ) : (
        <ol className="flex flex-1 flex-col divide-y">
          {data.map((r, i) => (
            <li key={r.userId} className={cn(i === 0 && "bg-gradient-to-r from-medal-gold/[0.08] to-transparent")}>
              <Link href={`/store/${r.userId}`} className="hover:bg-accent/50 flex items-center gap-3 px-4 py-3 transition-colors">
                <span className={cn("w-6 shrink-0 text-center text-base font-bold tabular-nums", i < 3 ? MEDAL[i].text : "text-muted-foreground")}>
                  {i + 1}
                </span>
                <UserAvatar user={r} className="size-10 shrink-0" />
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate text-sm font-semibold">{displayNameOf(r)}</span>
                  {r.handle && <span className="text-muted-foreground truncate text-xs">@{r.handle}</span>}
                </span>
                <span className="flex shrink-0 flex-col items-end gap-0.5 text-right leading-tight">{value(r)}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function TopTraders({ rows, me }: { rows: TraderRow[]; me: Me | null }) {
  const t = useT();
  const money = useMoney();

  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-6 sm:gap-8">
        {me && <YourStanding me={me} rows={rows} ranks={[]} />}
        <p className="text-muted-foreground rounded-2xl border border-dashed py-16 text-center text-sm">
          {t("No completed sales yet — traders show up here once someone buys a card.")}
        </p>
      </div>
    );
  }

  // Board-wide totals, shown as the same stat-card row the Market page uses.
  const cardsTraded = rows.reduce((n, r) => n + r.positions.length, 0);
  const wins = rows.reduce((n, r) => n + r.wins, 0);
  const closed = rows.reduce((n, r) => n + r.closedTrades, 0);
  const totalGains = rows.reduce((n, r) => n + r.totalGainThb, 0);
  const stats = [
    { label: "Traders ranked", value: rows.length.toLocaleString() },
    { label: "Cards traded", value: cardsTraded.toLocaleString() },
    { label: "Flips won", value: closed > 0 ? `${wins}/${closed}` : "—" },
    { label: "Total gains", value: money(totalGains) },
  ];

  // Full ranked order for each category, so a trader's position is known even
  // when they fall outside a board's visible top ten.
  const byGain = [...rows].sort((a, b) => b.totalGainThb - a.totalGainThb);
  const byReturn = rows.filter((r) => r.totalGainPct != null).sort((a, b) => b.totalGainPct! - a.totalGainPct!);
  const byFlips = rows
    .filter((r) => r.closedTrades > 0)
    .sort((a, b) => b.wins - a.wins || b.wins / b.closedTrades - a.wins / a.closedTrades);
  const byVolume = rows.filter((r) => r.closedTrades > 0).sort((a, b) => b.closedTrades - a.closedTrades);
  const top = <T,>(arr: T[]) => arr.slice(0, 10);

  // Four category boards, each ranking the same traders by a different metric
  // so a different person can lead each one.
  const boards: Board[] = [
    {
      title: t("Biggest Winners"),
      icon: TrendingUp,
      data: top(byGain),
      empty: t("No gains yet"),
      value: (r) => <Gain thb={r.totalGainThb} className="text-base font-bold" />,
    },
    {
      title: t("Hot Hands"),
      icon: Flame,
      data: top(byReturn),
      empty: t("No returns yet"),
      value: (r) => <Pct pct={r.totalGainPct} className="text-base font-bold" />,
    },
    {
      title: t("Deal Closers"),
      icon: Handshake,
      data: top(byFlips),
      empty: t("No flips sold yet"),
      value: (r) => <span className="text-success text-base font-bold tabular-nums">{r.wins}/{r.closedTrades}</span>,
    },
    {
      title: t("Volume Kings"),
      icon: Layers,
      data: top(byVolume),
      empty: t("No sales yet"),
      value: (r) => <span className="text-base font-bold tabular-nums">{r.closedTrades}</span>,
    },
  ];

  // The viewer's position on each board, shown as chips on "Your standing".
  const posOf = (list: TraderRow[]) => {
    const i = me ? list.findIndex((r) => r.userId === me.id) : -1;
    return i < 0 ? null : i + 1;
  };
  const myRanks: MyRank[] = [
    { label: t("Gains"), title: t("Biggest Winners"), icon: TrendingUp, rank: posOf(byGain) },
    { label: t("Return"), title: t("Hot Hands"), icon: Flame, rank: posOf(byReturn) },
    { label: t("Flips"), title: t("Deal Closers"), icon: Handshake, rank: posOf(byFlips) },
    { label: t("Volume"), title: t("Volume Kings"), icon: Layers, rank: posOf(byVolume) },
  ];

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      {me && <YourStanding me={me} rows={rows} ranks={myRanks} />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-card flex flex-col gap-1 rounded-xl border p-4">
            <span className="text-muted-foreground text-xs tracking-wide uppercase">{t(s.label)}</span>
            <span className="text-xl leading-tight font-bold tabular-nums">{s.value}</span>
          </div>
        ))}
      </div>

      {/* Four category leaderboards, side by side on wide screens. */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="bg-foreground text-background flex size-7 items-center justify-center rounded-lg">
            <Trophy className="size-3.5" />
          </div>
          <h2 className="text-lg font-semibold">{t("Category leaders")}</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {boards.map((b) => (
            <CategoryBoard key={b.title} {...b} />
          ))}
        </div>
      </div>

      {/* What each board is ranked by. */}
      <section className="bg-card rounded-2xl border">
        <div className="flex items-center gap-2 border-b px-4 py-3 sm:px-6">
          <div className="bg-foreground text-background flex size-7 items-center justify-center rounded-lg">
            <Info className="size-3.5" />
          </div>
          <h2 className="font-semibold">{t("How to read the leaderboard")}</h2>
        </div>
        <dl className="grid gap-4 px-4 py-4 sm:grid-cols-2 sm:px-6 xl:grid-cols-4">
          <div className="flex flex-col gap-1">
            <dt className="text-sm font-semibold">{t("Biggest Winners")}</dt>
            <dd className="text-muted-foreground text-sm leading-relaxed">
              {t("Ranked by total gain in baht: realized profit plus paper gains on cards still held.")}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-sm font-semibold">{t("Hot Hands")}</dt>
            <dd className="text-muted-foreground text-sm leading-relaxed">
              {t("Ranked by return %: gain measured against what they paid, so a sharp small trader can top a whale.")}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-sm font-semibold">{t("Deal Closers")}</dt>
            <dd className="text-muted-foreground text-sm leading-relaxed">
              {t("Ranked by flips won: cards bought then sold for more than they cost. 2/3 means 3 sold, 2 at a profit.")}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-sm font-semibold">{t("Volume Kings")}</dt>
            <dd className="text-muted-foreground text-sm leading-relaxed">
              {t("Ranked by cards sold: how many completed sales they've made on CardMart.")}
            </dd>
          </div>
        </dl>
      </section>
      <p className="text-muted-foreground text-xs leading-relaxed">
        {t("Built from completed escrow sales only. Realized = sold price − bought price. Unrealized = a held card's current asking price − bought price. A first sale by the card's minter has no purchase price, so it isn't counted as a gain; swaps aren't counted either.")}
      </p>
    </div>
  );
}
