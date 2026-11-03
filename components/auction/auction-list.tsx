"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { Expand, Gavel, LayoutGrid, List, Search, Timer } from "lucide-react";
import type { CardGame, GradingCompany } from "@prisma/client";

import { CardArt } from "@/components/asset/card-art";
import { CountdownTimer } from "@/components/auction/countdown-timer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserAvatar } from "@/components/messages/user-avatar";
import { CARD_GAME_BADGE_CLASS, CARD_GAME_LABELS } from "@/lib/labels";
import { displayImage } from "@/lib/card-image";
import { formatDateTime, formatGrade } from "@/lib/format";
import { useMoney } from "@/components/currency-provider";
import type { getActiveAuctions } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useT } from "@/components/landing/language-provider";

type Auction = Awaited<ReturnType<typeof getActiveAuctions>>[number];

// Desktop columns: picture+card, starting bid, current bid, bids, ends, action.
const COLUMNS = "md:grid-cols-[minmax(0,2.2fr)_1fr_1.2fr_0.7fr_1.3fr_8.5rem]";

const noSubscribe = () => () => {};

// The end time in the viewer's own time zone. Rendered only after hydration:
// the server's zone may differ, and a mismatched date would be wrong, not just stale.
function EndsAt({ endTime }: { endTime: string }) {
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false);
  return <span>{mounted ? formatDateTime(endTime) : " "}</span>;
}

function bidderName(bidder: { name: string | null; handle: string | null }, fallback: string) {
  return bidder.name ?? (bidder.handle ? `@${bidder.handle}` : fallback);
}

/** Small picture that opens the full-size one in a dialog. */
function Thumbnail({ auction }: { auction: Auction }) {
  const t = useT();
  const { asset } = auction;
  const photo = displayImage(asset);
  const art = (size: "sm" | "lg") =>
    photo ? (
      <Image
        src={photo.url}
        alt={asset.name}
        fill
        sizes={size === "sm" ? "80px" : "(max-width: 640px) 90vw, 480px"}
        className="object-contain"
      />
    ) : (
      <CardArt
        themeIndex={asset.themeIndex}
        category={asset.category}
        gradingCompany={asset.gradingCompany}
        grade={asset.grade}
        isBlackLabel={asset.isBlackLabel}
        bordered={false}
        className="h-full w-auto"
      />
    );

  return (
    <Dialog>
      <DialogTrigger
        aria-label={t("Enlarge picture")}
        className="group/thumb card-stage focus-visible:ring-ring relative flex aspect-[3/4] w-16 shrink-0 cursor-zoom-in items-center justify-center overflow-hidden rounded-lg border outline-none focus-visible:ring-2 sm:w-20"
      >
        {art("sm")}
        <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover/thumb:opacity-100">
          <Expand className="size-4 text-white" />
        </span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg p-4 sm:p-6">
        <DialogTitle className="pr-8 text-base">{asset.name}</DialogTitle>
        <div className="card-stage relative mx-auto flex aspect-[3/4] max-h-[75vh] w-full items-center justify-center overflow-hidden rounded-xl">
          {art("lg")}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AuctionRow({ auction }: { auction: Auction }) {
  const money = useMoney();
  const t = useT();
  const { asset } = auction;
  const href = `/auctions/${auction.id}`;
  const endTime = auction.endTime.toISOString();
  const count = auction._count.bids;
  const leader = auction.bids[0];
  const grade =
    asset.gradingCompany === "RAW"
      ? t("Raw")
      : `${asset.gradingCompany} ${formatGrade(asset.grade)}${asset.isBlackLabel ? " BL" : ""}`;
  const label = "text-muted-foreground text-[10px] tracking-wide uppercase md:hidden";

  return (
    <li className="bg-card hover:border-foreground/20 rounded-xl border transition-colors">
      <div className={cn("grid grid-cols-2 items-center gap-x-4 gap-y-3 p-3 sm:p-4", COLUMNS)}>
        {/* Picture + card */}
        <div className="col-span-2 flex min-w-0 items-center gap-3 md:col-span-1">
          <Thumbnail auction={auction} />
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <span className="bg-destructive size-1.5 animate-pulse rounded-full" />
              {t("Live")}
              <span
                className={cn(
                  "ml-0.5 rounded px-1.5 py-0.5 text-[10px] leading-none font-semibold",
                  CARD_GAME_BADGE_CLASS[asset.game],
                )}
              >
                {t(CARD_GAME_LABELS[asset.game])}
              </span>
            </span>
            <Link href={href} className="truncate font-semibold hover:underline">
              {asset.name}
            </Link>
            <span className="text-muted-foreground truncate text-xs">{asset.subtitle}</span>
            <span className="w-fit rounded-md border px-1.5 py-0.5 font-mono text-[11px]">{grade}</span>
          </div>
        </div>

        {/* Starting bid */}
        <div className="flex flex-col gap-0.5">
          <span className={label}>{t("Starting Bid")}</span>
          <span className="text-sm font-medium tabular-nums">{money(auction.startPriceThb)}</span>
        </div>

        {/* Current bid + leader */}
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className={label}>{t("Current Bid")}</span>
          {auction.currentBidThb != null ? (
            <>
              <span className="text-success text-base font-bold tabular-nums">{money(auction.currentBidThb)}</span>
              {leader && (
                <span className="text-muted-foreground truncate text-xs">
                  {t("Leading: {name}", { name: bidderName(leader.bidder, t("A bidder")) })}
                </span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground text-sm">{t("No bids yet")}</span>
          )}
        </div>

        {/* Bid count */}
        <div className="flex flex-col gap-0.5">
          <span className={label}>{t("Bids")}</span>
          <span className="flex items-center gap-1.5 text-sm font-medium tabular-nums">
            <Gavel className="text-muted-foreground size-3.5" />
            {count}
          </span>
        </div>

        {/* Ends */}
        <div className="flex flex-col gap-0.5">
          <span className={label}>{t("Ends in")}</span>
          <span className="flex items-center gap-1.5">
            <Timer className="text-muted-foreground size-3.5" />
            <CountdownTimer endTime={endTime} className="text-sm font-bold tabular-nums" />
          </span>
          <span className="text-muted-foreground text-xs tabular-nums">
            <EndsAt endTime={endTime} />
          </span>
        </div>

        {/* Action */}
        <Button asChild size="sm" className="col-span-2 w-full md:col-span-1">
          <Link href={href}>
            <Gavel /> {count === 0 ? t("Bid first") : t("Place a bid")}
          </Link>
        </Button>
      </div>

      {auction.bids.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t px-3 py-2 text-xs sm:px-4">
          <span className="text-muted-foreground">{t("Recent bids")}</span>
          {auction.bids.map((bid, i) => (
            <span key={bid.id} className={cn("flex items-center gap-1.5", i > 0 && "text-muted-foreground")}>
              <span className="max-w-32 truncate">{bidderName(bid.bidder, t("A bidder"))}</span>
              <span className="font-semibold tabular-nums">{money(bid.amountThb)}</span>
            </span>
          ))}
        </div>
      )}
    </li>
  );
}

/** The live auctions as rows: card, prices, bids and time left all readable without opening one. */
function AuctionRows({ auctions }: { auctions: Auction[] }) {
  const t = useT();
  const head = "text-muted-foreground text-[11px] font-medium tracking-wide uppercase";
  return (
    <div className="flex flex-col gap-2">
      <div className={cn("hidden gap-x-4 px-4 md:grid", COLUMNS)} aria-hidden>
        <span className={head}>{t("Card")}</span>
        <span className={head}>{t("Starting Bid")}</span>
        <span className={head}>{t("Current Bid")}</span>
        <span className={head}>{t("Bids")}</span>
        <span className={head}>{t("Ends in")}</span>
        <span />
      </div>
      <ul className="flex flex-col gap-2">
        {auctions.map((auction) => (
          <AuctionRow key={auction.id} auction={auction} />
        ))}
      </ul>
    </div>
  );
}

const CHIP = "flex items-center gap-1 rounded-md bg-black/70 px-2 py-1.5 text-[11px] leading-none font-semibold text-white backdrop-blur-sm";

/** One auction as a tile: the card big, the countdown on it, then the bid. */
function AuctionTile({ auction }: { auction: Auction }) {
  const money = useMoney();
  const t = useT();
  const { asset } = auction;
  const href = `/auctions/${auction.id}`;
  const photo = displayImage(asset);
  const count = auction._count.bids;
  const sellerName = asset.seller.name ?? t("Collector");
  const details = [asset.subtitle, asset.cardNumber && `#${asset.cardNumber}`, asset.language === "JAPANESE" && t("Japanese")]
    .filter(Boolean)
    .join(" · ");

  return (
    <li>
      <Link
        href={href}
        className="group bg-card focus-visible:ring-ring flex h-full flex-col overflow-hidden rounded-2xl border outline-none transition-colors hover:border-foreground/30 focus-visible:ring-2"
      >
        <div className="card-stage relative aspect-[4/5] overflow-hidden">
          {photo ? (
            <Image
              src={photo.url}
              alt={asset.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 20vw"
              className="photo-shadow object-contain p-4 transition-transform duration-300 group-hover:scale-[1.04] sm:p-5"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center p-5">
              <CardArt
                themeIndex={asset.themeIndex}
                category={asset.category}
                gradingCompany={asset.gradingCompany}
                grade={asset.grade}
                isBlackLabel={asset.isBlackLabel}
                bordered={false}
                showGrade={false}
                className="h-full w-auto rounded-lg"
              />
            </div>
          )}
          {/* Time left, top-left; where the bidding started, bottom-right. */}
          <span className={cn(CHIP, "absolute top-2.5 left-2.5")}>
            <Timer className="size-3.5" />
            <CountdownTimer endTime={auction.endTime.toISOString()} className="tabular-nums" />
          </span>
          <span className={cn(CHIP, "absolute right-2.5 bottom-2.5 tabular-nums")}>
            {t("Start {price}", { price: money(auction.startPriceThb) })}
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-1 p-3.5 sm:p-4">
          <h3 className="truncate text-sm font-semibold" title={asset.name}>
            {asset.name}
          </h3>
          <p className="text-muted-foreground truncate text-xs">{details}</p>
          {/* The current bid is the headline; with no bids yet, the opening price. */}
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-lg font-bold tabular-nums">{money(auction.currentBidThb ?? auction.startPriceThb)}</span>
            <span className="text-muted-foreground flex items-center gap-1 text-xs">
              <Gavel className="size-3" />
              {t("{count} bids", { count })}
            </span>
          </div>
          <div className="mt-auto flex items-center justify-between gap-2 pt-2.5">
            <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
              <UserAvatar user={{ name: sellerName, handle: null, image: asset.seller.image ?? null }} className="size-5 [&_*]:text-[9px]" />
              <span className="truncate">{sellerName}</span>
            </span>
          </div>
        </div>
      </Link>
    </li>
  );
}

type SortKey = "ending" | "bids" | "high" | "low" | "newest";
type Window = "any" | "1h" | "24h" | "7d";
const WINDOW_MS: Record<Window, number> = { any: Infinity, "1h": 3_600_000, "24h": 86_400_000, "7d": 7 * 86_400_000 };

const currentBid = (a: Auction) => a.currentBidThb ?? a.startPriceThb;

// The clock to the minute, as an external store: stable between renders, and it
// re-renders the list once a minute so "Ending within" stays true over time.
const currentMinute = () => Math.floor(Date.now() / 60_000) * 60_000;
function subscribeMinute(onChange: () => void) {
  const id = setInterval(onChange, 60_000);
  return () => clearInterval(id);
}

/**
 * Live auctions with a search box, sort, filters and a grid / list switch.
 * Everything runs on the list already loaded, so filtering is instant.
 */
export function AuctionList({ auctions }: { auctions: Auction[] }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("ending");
  const [game, setGame] = useState<"ALL" | CardGame>("ALL");
  const [grader, setGrader] = useState<"ALL" | GradingCompany>("ALL");
  const [window, setWindow] = useState<Window>("any");
  const [view, setView] = useState<"grid" | "list">("grid");
  // "Ending within" needs the viewer's clock: null on the server, so it only applies after hydration.
  const now = useSyncExternalStore(subscribeMinute, currentMinute, () => null);

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = auctions.filter((a) => {
      const { asset } = a;
      if (game !== "ALL" && asset.game !== game) return false;
      if (grader !== "ALL" && asset.gradingCompany !== grader) return false;
      if (now != null && window !== "any" && a.endTime.getTime() - now > WINDOW_MS[window]) return false;
      const haystack = [asset.name, asset.subtitle, asset.cardNumber, asset.gradingCompany, asset.grade != null ? formatGrade(asset.grade) : ""]
        .join(" ")
        .toLowerCase();
      return words.every((w) => haystack.includes(w));
    });
    const by: Record<SortKey, (a: Auction, b: Auction) => number> = {
      ending: (a, b) => a.endTime.getTime() - b.endTime.getTime(),
      bids: (a, b) => b._count.bids - a._count.bids,
      high: (a, b) => currentBid(b) - currentBid(a),
      low: (a, b) => currentBid(a) - currentBid(b),
      newest: (a, b) => b.startTime.getTime() - a.startTime.getTime(),
    };
    return [...list].sort(by[sort]);
  }, [auctions, q, sort, game, grader, window, now]);

  const filtered = q !== "" || game !== "ALL" || grader !== "ALL" || window !== "any";
  const trigger = "bg-card h-10 w-auto gap-2 rounded-lg px-3 text-sm font-semibold";
  // On phones the three filters share one row, so each takes a third and its label truncates.
  const filter = cn(trigger, "w-full min-w-0 gap-1 px-2.5 [&>span]:min-w-0 [&>span]:truncate sm:w-auto sm:gap-2 sm:px-3");

  return (
    <div className="flex flex-col gap-4">
      {/* Search and sort. */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="bg-card focus-within:ring-ring flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-lg border px-3.5 focus-within:ring-2">
          <Search className="text-muted-foreground size-4 shrink-0" />
          <input
            id="auction-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("Try Umbreon PSA 10 or OP01-121")}
            className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className={cn(trigger, "h-11")} aria-label={t("Sort")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="ending">{t("Ending soonest")}</SelectItem>
            <SelectItem value="bids">{t("Most bids")}</SelectItem>
            <SelectItem value="high">{t("Highest bid")}</SelectItem>
            <SelectItem value="low">{t("Lowest bid")}</SelectItem>
            <SelectItem value="newest">{t("Newest")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Filters. */}
      <div className="grid grid-cols-3 items-center gap-2 sm:flex sm:flex-wrap">
        <Select value={game} onValueChange={(v) => setGame(v as typeof game)}>
          <SelectTrigger className={filter} aria-label={t("Game")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("All games")}</SelectItem>
            <SelectItem value="POKEMON">{t(CARD_GAME_LABELS.POKEMON)}</SelectItem>
            <SelectItem value="ONE_PIECE">{t(CARD_GAME_LABELS.ONE_PIECE)}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={window} onValueChange={(v) => setWindow(v as Window)}>
          <SelectTrigger className={filter} aria-label={t("Ending within")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">{t("Any time")}</SelectItem>
            <SelectItem value="1h">{t("Next hour")}</SelectItem>
            <SelectItem value="24h">{t("Next 24 hours")}</SelectItem>
            <SelectItem value="7d">{t("Next 7 days")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={grader} onValueChange={(v) => setGrader(v as typeof grader)}>
          <SelectTrigger className={filter} aria-label={t("Grader")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("All graders")}</SelectItem>
            <SelectItem value="PSA">PSA</SelectItem>
            <SelectItem value="BGS">BGS</SelectItem>
            <SelectItem value="CGC">CGC</SelectItem>
            <SelectItem value="RAW">{t("Ungraded")}</SelectItem>
          </SelectContent>
        </Select>
        {filtered && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setGame("ALL");
              setGrader("ALL");
              setWindow("any");
            }}
            className="text-muted-foreground hover:text-foreground col-span-3 justify-self-start px-1 text-sm underline underline-offset-4"
          >
            {t("Clear filters")}
          </button>
        )}
      </div>

      {/* Count and view switch. */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground text-sm">{t("{count} live auctions", { count: shown.length })}</span>
        <div className="bg-card flex rounded-lg border p-0.5" role="group" aria-label={t("View")}>
          {(
            [
              ["grid", LayoutGrid, t("Grid")],
              ["list", List, t("List")],
            ] as const
          ).map(([key, Icon, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              aria-pressed={view === key}
              aria-label={label}
              title={label}
              className={cn(
                "flex size-8 items-center justify-center rounded-md transition-colors",
                view === key ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-20 text-center">
          <Gavel className="size-8" />
          <p className="text-sm">{t("No auctions match these filters.")}</p>
        </div>
      ) : view === "grid" ? (
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map((auction) => (
            <AuctionTile key={auction.id} auction={auction} />
          ))}
        </ul>
      ) : (
        <AuctionRows auctions={shown} />
      )}
    </div>
  );
}
