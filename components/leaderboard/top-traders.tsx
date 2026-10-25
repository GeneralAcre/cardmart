"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ChevronDown, Crown, Diamond } from "lucide-react";

import { CardArt } from "@/components/asset/card-art";
import { UserAvatar, displayNameOf } from "@/components/messages/user-avatar";
import { formatDate, formatGrade } from "@/lib/format";
import { useMoney } from "@/components/currency-provider";
import type { TraderPosition, TraderRow } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useT } from "@/components/landing/language-provider";

function gradeSymbol(p: TraderPosition) {
  if (p.gradingCompany === "RAW") return "RAW";
  return `${p.gradingCompany} ${formatGrade(p.grade)}${p.isBlackLabel ? " BL" : ""}`;
}

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

// Gold / silver / bronze: the podium numerals, its top-edge glow, and the
// first three rank badges in the table.
const MEDAL = [
  { text: "text-[#F2C14E]", line: "via-[#F2C14E]", ring: "ring-[#F2C14E]/60", badge: "bg-[#F2C14E] text-black" },
  { text: "text-[#C9D3E0]", line: "via-[#C9D3E0]", ring: "ring-[#C9D3E0]/40", badge: "bg-[#C9D3E0] text-black" },
  { text: "text-[#D98A55]", line: "via-[#D98A55]", ring: "ring-[#D98A55]/40", badge: "bg-[#D98A55] text-black" },
];

const pad = (n: number) => String(n).padStart(2, "0");

function RankBadge({ rank, className }: { rank: number; className?: string }) {
  const medal = MEDAL[rank - 1];
  return (
    <span
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
        medal ? medal.badge : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {rank}
    </span>
  );
}

// The oversized, barely-there rank number behind a card.
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

function YourStanding({ me, rows }: { me: Me; rows: TraderRow[] }) {
  const money = useMoney();
  const t = useT();
  const idx = rows.findIndex((r) => r.userId === me.id);
  const row = idx >= 0 ? rows[idx] : null;
  const rank = idx + 1;
  const ahead = idx > 0 ? rows[idx - 1] : null;

  return (
    <section className="bg-card relative overflow-hidden rounded-2xl border">
      {row && <Watermark className="-right-3 -bottom-6 text-[7rem] sm:-right-4 sm:-bottom-10 sm:text-[14rem]">{rank}</Watermark>}
      <div className="relative flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-8">
        <div className="flex flex-col gap-1 sm:border-r sm:pr-8">
          <span className="text-muted-foreground text-[11px] font-medium tracking-[0.2em] uppercase">{t("Your standing")}</span>
          <span className="text-4xl font-bold tracking-tight tabular-nums sm:text-6xl">{row ? `#${rank}` : "—"}</span>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-4">
          <UserAvatar user={me} className="size-12 text-sm sm:size-16 sm:text-base" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-xl font-semibold sm:text-2xl">{me.handle ? `@${me.handle}` : displayNameOf(me)}</span>
            <span className="truncate text-sm font-medium text-[#F2C14E]">
              {!row
                ? t("Buy a card to get on the board")
                : ahead
                  ? t("{amount} to #{rank}", { amount: money(Math.max(0, ahead.totalGainThb - row.totalGainThb)), rank: rank - 1 })
                  : t("Top of the board")}
            </span>
          </div>
        </div>

        {row && (
          <div className="flex items-center justify-between gap-6 border-t pt-4 sm:justify-start sm:gap-8 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-8">
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl font-semibold tabular-nums">{winRate(row)}</span>
              <span className="text-muted-foreground text-[11px] tracking-[0.2em] uppercase">{t("Flips won")}</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Gain thb={row.totalGainThb} className="text-2xl font-semibold" />
              <span className="text-muted-foreground text-[11px] tracking-[0.2em] uppercase">{t("Total gain")}</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/** An empty podium spot: the same card shell as a trader's, with nothing in it yet. */
function PodiumPlaceholder({ rank }: { rank: number }) {
  const t = useT();
  const medal = MEDAL[rank - 1];
  const first = rank === 1;
  return (
    <div className="bg-card/60 relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-dashed p-4 sm:p-6">
      <Watermark className="-top-2 -right-2 text-[6rem] sm:-top-3 sm:-right-3 sm:text-[8rem]">{pad(rank)}</Watermark>
      <span className={cn("relative font-bold leading-none tracking-tight tabular-nums opacity-40", medal.text, first ? "text-5xl sm:text-7xl" : "text-5xl sm:text-6xl")}>
        {pad(rank)}
      </span>
      <span className="relative mt-3 flex min-w-0 items-center gap-3">
        <span aria-hidden className={cn("shrink-0 rounded-full border-2 border-dashed opacity-50", medal.ring.replace("ring-", "border-"), first ? "size-14 sm:size-20" : "size-14 sm:size-[4.5rem]")} />
        <span aria-hidden className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="bg-muted h-4 w-3/4 rounded" />
          <span className="bg-muted h-3 w-1/2 rounded" />
        </span>
      </span>
      <span className="relative mt-4 flex items-center justify-between gap-3 border-t pt-3 sm:mt-6 sm:pt-5">
        <span className="text-muted-foreground text-base font-medium tracking-[0.15em] uppercase sm:text-lg">{t("Total gain")}</span>
        <span aria-hidden className="bg-muted h-6 w-24 rounded" />
      </span>
    </div>
  );
}

function PodiumCard({ r, rank, onSelect }: { r: TraderRow; rank: number; onSelect: () => void }) {
  const t = useT();
  const medal = MEDAL[rank - 1];
  const first = rank === 1;
  return (
    <button
      type="button"
      onClick={onSelect}
      className="bg-card hover:border-foreground/25 relative flex h-full w-full flex-col overflow-hidden rounded-2xl border p-4 text-left sm:p-6 transition-colors"
    >
      {/* thin medal-coloured glow along the top edge */}
      <span aria-hidden className={cn("absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent to-transparent", medal.line)} />
      <Watermark className="-top-2 -right-2 text-[6rem] sm:-top-3 sm:-right-3 sm:text-[8rem]">{pad(rank)}</Watermark>
      {first ? (
        <Crown className={cn("absolute top-4 right-4 size-5 sm:top-5 sm:right-5 sm:size-6", medal.text)} />
      ) : (
        <Diamond className={cn("absolute top-4 right-4 size-3.5 sm:top-6 sm:right-6", medal.text)} />
      )}

      <span className={cn("relative font-bold leading-none tracking-tight tabular-nums", medal.text, first ? "text-5xl sm:text-7xl" : "text-5xl sm:text-6xl")}>
        {pad(rank)}
      </span>

      <span className="relative mt-3 flex min-w-0 items-center gap-3">
        <UserAvatar user={r} className={cn("ring-2 ring-offset-2 ring-offset-card", medal.ring, first ? "size-14 sm:size-20" : "size-14 sm:size-[4.5rem]")} />
        <span className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-lg font-semibold">{r.handle ? `@${r.handle}` : displayNameOf(r)}</span>
          <span className="text-muted-foreground truncate text-xs">
            {t(r.positions.length === 1 ? "{count} card bought" : "{count} cards bought", { count: r.positions.length })}
            {r.closedTrades > 0 && ` · ${t("{wins}/{total} flips won", { wins: r.wins, total: r.closedTrades })}`}
          </span>
        </span>
      </span>

      <span className="relative mt-4 flex items-center justify-between gap-3 border-t pt-3 sm:mt-6 sm:pt-5">
        <span className="text-muted-foreground text-base font-medium tracking-[0.15em] sm:text-lg uppercase">{t("Total gain")}</span>
        <span className="flex flex-col items-end">
          <Gain thb={r.totalGainThb} className="text-lg font-bold sm:text-2xl" />
          <Pct pct={r.totalGainPct} className="text-sm font-medium" />
        </span>
      </span>
    </button>
  );
}

// Phones: a literal podium. 2 · 1 · 3 side by side, each trader standing on a
// block whose height follows their rank, so the winner is in the middle on top.
function MobilePodium({ rows, onSelect }: { rows: TraderRow[]; onSelect: (id: string) => void }) {
  const top = rows.slice(0, 3);
  const order = [1, 0, 2];
  const blockHeight = ["h-32", "h-24", "h-20"];
  return (
    <ol className="grid grid-cols-3 items-end gap-2 sm:hidden">
      {order.map((i) => {
        const r = top[i];
        const medal = MEDAL[i];
        const first = i === 0;
        if (!r) {
          // An empty spot: a dashed avatar, a blank name line and the block with just its number.
          return (
            <li key={`empty-${i}`} className="min-w-0">
              <div aria-hidden className="flex w-full min-w-0 flex-col items-center gap-1.5">
                <span className={cn("rounded-full border-2 border-dashed opacity-50", medal.ring.replace("ring-", "border-"), first ? "size-16" : "size-12")} />
                <span className="bg-muted h-3 w-2/3 rounded" />
                <span className={cn("bg-card/60 relative flex w-full items-start justify-center overflow-hidden rounded-t-xl border border-b-0 border-dashed pt-2", blockHeight[i])}>
                  <span className={cn("text-3xl font-bold leading-none tabular-nums opacity-40", medal.text)}>{pad(i + 1)}</span>
                </span>
              </div>
            </li>
          );
        }
        return (
          <li key={r.userId} className="min-w-0">
            <button type="button" onClick={() => onSelect(r.userId)} className="flex w-full min-w-0 flex-col items-center gap-1.5 text-center">
              {first && <Crown className={cn("size-5", medal.text)} />}
              <UserAvatar user={r} className={cn("ring-2 ring-offset-2 ring-offset-background", medal.ring, first ? "size-16" : "size-12")} />
              <span className="w-full truncate text-xs font-semibold">{r.handle ? `@${r.handle}` : displayNameOf(r)}</span>
              <span
                className={cn(
                  "bg-card relative flex w-full flex-col items-center gap-1 overflow-hidden rounded-t-xl border border-b-0 px-1 pt-2",
                  blockHeight[i],
                )}
              >
                <span aria-hidden className={cn("absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent to-transparent", medal.line)} />
                <span className={cn("text-3xl font-bold leading-none tabular-nums", medal.text)}>{pad(i + 1)}</span>
                <span className="flex w-full flex-col items-center gap-0.5">
                  <Gain thb={r.totalGainThb} className="w-full truncate text-xs font-bold" />
                  <Pct pct={r.totalGainPct} className="text-[10px]" />
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function winRate(r: TraderRow) {
  return r.closedTrades > 0 ? `${r.wins}/${r.closedTrades}` : "—";
}

export function TopTraders({ rows, me }: { rows: TraderRow[]; me: Me }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const t = useT();

  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-6 sm:gap-8">
        <YourStanding me={me} rows={rows} />
        <p className="text-muted-foreground rounded-2xl border border-dashed py-16 text-center text-sm">
          {t("No completed sales yet — traders show up here once someone buys a card.")}
        </p>
      </div>
    );
  }

  // 2 · 1 · 3 on wide screens, with the winner raised; 1 · 2 · 3 stacked on phones.
  const podiumOrder = ["sm:order-2", "sm:order-1 sm:mt-10", "sm:order-3 sm:mt-10"];

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <MobilePodium rows={rows} onSelect={setOpenId} />

      <ol className="hidden gap-4 sm:grid sm:grid-cols-3">
        {[0, 1, 2].map((i) => {
          const r = rows[i];
          return (
            <li key={r?.userId ?? `empty-${i}`} className={podiumOrder[i]}>
              {r ? <PodiumCard r={r} rank={i + 1} onSelect={() => setOpenId(r.userId)} /> : <PodiumPlaceholder rank={i + 1} />}
            </li>
          );
        })}
      </ol>

      <YourStanding me={me} rows={rows} />

      {/* Full standings */}
      <section className="overflow-hidden rounded-2xl border">
        <div className="bg-muted/40 text-muted-foreground grid grid-cols-[2.5rem_1fr_auto_1.5rem] items-center gap-3 border-b px-4 py-2.5 text-[11px] font-medium tracking-wider uppercase md:grid-cols-[2.5rem_1fr_5rem_5rem_7rem_7rem_8rem_1.5rem]">
          <span>{t("Rank")}</span>
          <span>{t("Trader")}</span>
          <span className="hidden text-right md:block">{t("Cards")}</span>
          <span className="hidden text-right md:block">{t("Flips won")}</span>
          <span className="hidden text-right md:block">{t("Realized")}</span>
          <span className="hidden text-right md:block">{t("Unrealized")}</span>
          <span className="text-right">{t("Total gain")}</span>
          <span />
        </div>

        <ol className="divide-y">
          {rows.map((r, i) => {
            const open = openId === r.userId;
            return (
              <li key={r.userId} className={cn(open && "bg-muted/20")}>
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : r.userId)}
                  aria-expanded={open}
                  className="hover:bg-accent/50 grid w-full grid-cols-[2.5rem_1fr_auto_1.5rem] items-center gap-3 px-4 py-3 text-left transition-colors md:grid-cols-[2.5rem_1fr_5rem_5rem_7rem_7rem_8rem_1.5rem]"
                >
                  <RankBadge rank={i + 1} />
                  <span className="flex min-w-0 items-center gap-3">
                    <UserAvatar user={r} className="size-9" />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-semibold">{displayNameOf(r)}</span>
                      {r.handle && <span className="text-muted-foreground truncate text-xs">@{r.handle}</span>}
                    </span>
                  </span>
                  <span className="hidden text-right text-sm tabular-nums md:block">{r.positions.length}</span>
                  <span className="hidden text-right text-sm tabular-nums md:block">{winRate(r)}</span>
                  <Gain thb={r.realizedThb} className="hidden text-right text-sm md:block" />
                  <Gain thb={r.unrealizedThb} className="hidden text-right text-sm md:block" />
                  <span className="flex flex-col items-end">
                    <Gain thb={r.totalGainThb} className="font-semibold" />
                    <Pct pct={r.totalGainPct} className="text-xs" />
                  </span>
                  <ChevronDown className={cn("text-muted-foreground size-4 justify-self-end transition-transform", open && "rotate-180")} />
                </button>

                {open && (
                  <div className="px-4 pb-4 md:pl-[4.25rem]">
                    <div className="bg-card rounded-lg border p-3">
                      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                        <span className="text-muted-foreground font-medium tracking-wider uppercase">
                          {t("What {name} traded", { name: displayNameOf(r) })}
                        </span>
                        <Link href={`/store/${r.userId}`} className="font-medium hover:underline">
                          {t("View store")} →
                        </Link>
                      </div>
                      <ul className="flex flex-col divide-y">
                        {r.positions.map((p) => (
                          <PositionRow key={`${p.assetId}-${p.boughtAt}`} p={p} />
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {/* What the numbers mean, led by "Flips won" since it's the least obvious. */}
      <details className="bg-card group rounded-2xl border">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold sm:px-6 [&::-webkit-details-marker]:hidden">
          {t("How to read the leaderboard")}
          <ChevronDown className="text-muted-foreground size-4 transition-transform group-open:rotate-180" />
        </summary>
        <dl className="grid gap-4 border-t px-4 py-4 sm:grid-cols-2 sm:px-6">
          <div className="flex flex-col gap-1">
            <dt className="text-sm font-semibold">{t("Flips won")}</dt>
            <dd className="text-muted-foreground text-sm leading-relaxed">
              {t("A flip is a card someone bought and then sold. It's won when the sale price beat what they paid. 2/3 means 3 cards sold and 2 of them for a profit. A dash means nothing sold yet.")}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-sm font-semibold">{t("Realized")}</dt>
            <dd className="text-muted-foreground text-sm leading-relaxed">
              {t("Profit locked in from cards already sold: sold price minus bought price.")}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-sm font-semibold">{t("Unrealized")}</dt>
            <dd className="text-muted-foreground text-sm leading-relaxed">
              {t("Paper profit on cards still held: the current asking price minus bought price. It changes until the card sells.")}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-sm font-semibold">{t("Total gain")}</dt>
            <dd className="text-muted-foreground text-sm leading-relaxed">
              {t("Realized plus unrealized. The board is ranked by this number.")}
            </dd>
          </div>
        </dl>
      </details>
      <p className="text-muted-foreground text-xs leading-relaxed">
        {t("Built from completed escrow sales only. Realized = sold price − bought price. Unrealized = a held card's current asking price − bought price. A first sale by the card's minter has no purchase price, so it isn't counted as a gain; swaps aren't counted either.")}
      </p>
    </div>
  );
}

function PositionRow({ p }: { p: TraderPosition }) {
  const money = useMoney();
  const t = useT();
  const sold = p.soldThb != null;
  return (
    <li className="flex items-center gap-3 py-2.5 text-sm">
      <Link href={`/item/${p.assetId}`} className="relative aspect-[3/4] w-10 shrink-0 overflow-hidden rounded border">
        {p.photoUrl ? (
          <Image src={p.photoUrl} alt="" fill sizes="40px" className="object-cover" />
        ) : (
          <CardArt
            themeIndex={p.themeIndex}
            category={p.category}
            gradingCompany={p.gradingCompany}
            grade={p.grade}
            isBlackLabel={p.isBlackLabel}
            bordered={false}
          />
        )}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-2">
          <Link href={`/item/${p.assetId}`} className="truncate font-medium hover:underline">
            {p.name}
          </Link>
          <span
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
              sold ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
            )}
          >
            {sold ? t("Sold") : t("Holding")}
          </span>
        </span>
        <span className="text-muted-foreground truncate text-xs">
          {gradeSymbol(p)} · {t("Bought {price} on {date}", { price: money(p.boughtThb), date: formatDate(p.boughtAt) })}
          {sold && p.soldAt
            ? ` · ${t("Sold {price} on {date}", { price: money(p.soldThb!), date: formatDate(p.soldAt) })}`
            : p.currentThb != null
              ? ` · ${t("Now {price}", { price: money(p.currentThb) })}`
              : ""}
        </span>
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <Gain thb={p.gainThb} className="font-medium" />
        <Pct pct={p.gainPct} className="text-xs" />
      </div>
    </li>
  );
}
