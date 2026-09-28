"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

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

function Gain({ thb, pct, className }: { thb: number | null; pct?: number | null; className?: string }) {
  if (thb == null) return <span className={cn("text-muted-foreground", className)}>—</span>;
  const tone = thb > 0 ? "text-success" : thb < 0 ? "text-destructive" : "text-muted-foreground";
  return (
    <span className={cn("tabular-nums", tone, className)}>
      {thb > 0 ? "+" : thb < 0 ? "−" : ""}
      {formatThb(Math.abs(thb))}
      {pct != null && <span className="ml-1 text-xs">({pct > 0 ? "+" : ""}{pct.toFixed(1)}%)</span>}
    </span>
  );
}

export function TopTraders({ rows }: { rows: TraderRow[] }) {
  const [openId, setOpenId] = useState<string | null>(rows[0]?.userId ?? null);
  const t = useT();

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground py-16 text-center text-sm">
        {t("No completed sales yet — traders show up here once someone buys a card.")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        {t("Who made money, and on which cards. Every card is one of a kind, so this shows what worked — there's no copy-trading a card someone else already owns.")}
      </p>

      <ol className="flex flex-col divide-y border-y">
        {rows.map((r, i) => {
          const open = openId === r.userId;
          return (
            <li key={r.userId}>
              <button
                type="button"
                onClick={() => setOpenId(open ? null : r.userId)}
                aria-expanded={open}
                className="hover:bg-accent/50 flex w-full items-center gap-3 py-3.5 text-left transition-colors sm:gap-4"
              >
                <span className="text-muted-foreground w-5 shrink-0 text-right text-sm tabular-nums">{i + 1}</span>
                <UserAvatar user={r} className="size-9" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">{displayNameOf(r)}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {r.handle && `@${r.handle} · `}
                    {t(r.positions.length === 1 ? "{count} card bought" : "{count} cards bought", { count: r.positions.length })}
                    {r.closedTrades > 0 && ` · ${t("{wins}/{total} flips won", { wins: r.wins, total: r.closedTrades })}`}
                  </span>
                </span>
                <span className="hidden flex-col items-end text-xs md:flex">
                  <span className="text-muted-foreground">{t("Realized")}</span>
                  <Gain thb={r.realizedThb} />
                </span>
                <span className="hidden flex-col items-end text-xs md:flex">
                  <span className="text-muted-foreground">{t("Unrealized")}</span>
                  <Gain thb={r.unrealizedThb} />
                </span>
                <span className="flex flex-col items-end">
                  <Gain thb={r.totalGainThb} className="font-semibold" />
                  {r.totalGainPct != null && (
                    <span className={cn("text-xs tabular-nums", r.totalGainPct >= 0 ? "text-success" : "text-destructive")}>
                      {r.totalGainPct > 0 ? "+" : ""}
                      {r.totalGainPct.toFixed(1)}%
                    </span>
                  )}
                </span>
                <ChevronDown className={cn("text-muted-foreground size-4 shrink-0 transition-transform", open && "rotate-180")} />
              </button>

              {open && (
                <div className="bg-muted/40 mb-3 rounded-lg p-3 sm:ml-9">
                  <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">{t("What {name} traded", { name: displayNameOf(r) })}</span>
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
              )}
            </li>
          );
        })}
      </ol>

      <p className="text-muted-foreground text-[11px]">
        {t("Built from completed escrow sales only. Realized = sold price − bought price. Unrealized = a held card's current asking price − bought price. A first sale by the card's minter has no purchase price, so it isn't counted as a gain; swaps aren't counted either.")}
      </p>
    </div>
  );
}

function PositionRow({ p }: { p: TraderPosition }) {
  const t = useT();
  return (
    <li className="flex items-center gap-3 py-2.5 text-sm">
      <Link href={`/item/${p.assetId}`} className="relative aspect-[3/4] w-9 shrink-0 overflow-hidden rounded border">
        {p.photoUrl ? (
          <Image src={p.photoUrl} alt="" fill sizes="36px" className="object-cover" />
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
      <div className="flex min-w-0 flex-1 flex-col">
        <Link href={`/item/${p.assetId}`} className="truncate font-medium hover:underline">
          {p.name}
        </Link>
        <span className="text-muted-foreground truncate text-xs">
          {gradeSymbol(p)} · {t("Bought {price} on {date}", { price: formatThb(p.boughtThb), date: formatDate(p.boughtAt) })}
          {p.soldThb != null && p.soldAt
            ? ` · ${t("Sold {price} on {date}", { price: formatThb(p.soldThb), date: formatDate(p.soldAt) })}`
            : p.currentThb != null
              ? ` · ${t("Holding, now {price}", { price: formatThb(p.currentThb) })}`
              : ` · ${t("Holding")}`}
        </span>
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <Gain thb={p.gainThb} />
        {p.gainPct != null && (
          <span className={cn("text-xs tabular-nums", p.gainPct >= 0 ? "text-success" : "text-destructive")}>
            {p.gainPct > 0 ? "+" : ""}
            {p.gainPct.toFixed(1)}%
          </span>
        )}
        <span className="text-muted-foreground text-[10px] uppercase">{p.soldThb != null ? t("Sold") : t("Holding")}</span>
      </div>
    </li>
  );
}
