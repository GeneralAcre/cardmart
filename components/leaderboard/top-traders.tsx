"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ChevronDown, Crown, Diamond, Info } from "lucide-react";

import { CardArt } from "@/components/asset/card-art";
import { UserAvatar, displayNameOf } from "@/components/messages/user-avatar";
import { formatDate, formatGrade, formatThb } from "@/lib/format";
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
  if (thb == null) return <span className={cn("text-muted-foreground", className)}>—</span>;
  return (
    <span className={cn("tabular-nums", toneOf(thb), className)}>
      {thb > 0 ? "+" : thb < 0 ? "−" : ""}
      {formatThb(Math.abs(thb))}
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
  const t = useT();
  const idx = rows.findIndex((r) => r.userId === me.id);
  const row = idx >= 0 ? rows[idx] : null;
  const rank = idx + 1;
  const ahead = idx > 0 ? rows[idx - 1] : null;

  return (
    <section className="bg-card relative overflow-hidden rounded-2xl border">
      {row && <Watermark className="-right-4 -bottom-10 text-[11rem] sm:text-[14rem]">{rank}</Watermark>}
      <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
        <div className="flex flex-col gap-1 sm:border-r sm:pr-8">
          <span className="text-muted-foreground text-[11px] font-medium tracking-[0.2em] uppercase">{t("Your standing")}</span>
          <span className="text-5xl font-bold tracking-tight tabular-nums sm:text-6xl">{row ? `#${rank}` : "—"}</span>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-4">
          <UserAvatar user={me} className="size-16 text-base" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-2xl font-semibold">{me.handle ? `@${me.handle}` : displayNameOf(me)}</span>
            <span className="truncate text-sm font-medium text-[#F2C14E]">
              {!row
                ? t("Buy a card to get on the board")
                : ahead
                  ? t("{amount} to #{rank}", { amount: formatThb(Math.max(0, ahead.totalGainThb - row.totalGainThb)), rank: rank - 1 })
                  : t("Top of the board")}
            </span>
          </div>
        </div>

        {row && (
          <div className="flex items-center gap-8 sm:border-l sm:pl-8">
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

function PodiumCard({ r, rank, onSelect }: { r: TraderRow; rank: number; onSelect: () => void }) {
  const t = useT();
  const medal = MEDAL[rank - 1];
  const first = rank === 1;
  return (
    <button
      type="button"
      onClick={onSelect}
      className="bg-card hover:border-foreground/25 relative flex h-full w-full flex-col overflow-hidden rounded-2xl border p-6 text-left transition-colors"
    >
      {/* thin medal-coloured glow along the top edge */}
      <span aria-hidden className={cn("absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent to-transparent", medal.line)} />
      <Watermark className="-top-3 -right-3 text-[8rem]">{pad(rank)}</Watermark>
      {first ? (
        <Crown className={cn("absolute top-5 right-5 size-6", medal.text)} />
      ) : (
        <Diamond className={cn("absolute top-6 right-6 size-3.5", medal.text)} />
      )}

      <span className={cn("relative font-bold leading-none tracking-tight tabular-nums", medal.text, first ? "text-7xl" : "text-6xl")}>
        {pad(rank)}
      </span>

      <span className="relative mt-3 flex min-w-0 items-center gap-3">
        <UserAvatar user={r} className={cn("ring-2 ring-offset-2 ring-offset-card", medal.ring, first ? "size-20" : "size-[4.5rem]")} />
        <span className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-lg font-semibold">{r.handle ? `@${r.handle}` : displayNameOf(r)}</span>
          <span className="text-muted-foreground truncate text-xs">
            {t(r.positions.length === 1 ? "{count} card bought" : "{count} cards bought", { count: r.positions.length })}
            {r.closedTrades > 0 && ` · ${t("{wins}/{total} flips won", { wins: r.wins, total: r.closedTrades })}`}
          </span>
        </span>
      </span>

      <span className="relative mt-6 flex items-end justify-between gap-2 border-t pt-5">
        <span className="flex flex-col gap-1">
          <span className="flex items-baseline gap-2">
            <Gain thb={r.totalGainThb} className="text-3xl font-bold" />
            <Pct pct={r.totalGainPct} className="text-sm font-medium" />
          </span>
          <span className="text-muted-foreground text-[11px] tracking-[0.2em] uppercase">{t("Total gain")}</span>
        </span>
        {first && <span className={cn("text-[11px] font-bold tracking-[0.15em] uppercase", medal.text)}>{t("Top trader")}</span>}
      </span>
    </button>
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
      <div className="flex flex-col gap-8">
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
    <div className="flex flex-col gap-8">
      <YourStanding me={me} rows={rows} />

      <ol className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {rows.slice(0, 3).map((r, i) => (
          <li key={r.userId} className={podiumOrder[i]}>
            <PodiumCard r={r} rank={i + 1} onSelect={() => setOpenId(r.userId)} />
          </li>
        ))}
      </ol>

      <div className="text-muted-foreground flex items-start gap-3 text-sm">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          {t("Who made money, and on which cards. Every card is one of a kind, so this shows what worked — there's no copy-trading a card someone else already owns.")}
        </p>
      </div>

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

      <p className="text-muted-foreground text-xs leading-relaxed">
        {t("Built from completed escrow sales only. Realized = sold price − bought price. Unrealized = a held card's current asking price − bought price. A first sale by the card's minter has no purchase price, so it isn't counted as a gain; swaps aren't counted either.")}
      </p>
    </div>
  );
}

function PositionRow({ p }: { p: TraderPosition }) {
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
          {gradeSymbol(p)} · {t("Bought {price} on {date}", { price: formatThb(p.boughtThb), date: formatDate(p.boughtAt) })}
          {sold && p.soldAt
            ? ` · ${t("Sold {price} on {date}", { price: formatThb(p.soldThb!), date: formatDate(p.soldAt) })}`
            : p.currentThb != null
              ? ` · ${t("Now {price}", { price: formatThb(p.currentThb) })}`
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
