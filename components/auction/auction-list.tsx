"use client";

import { useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { Expand, Gavel, Timer } from "lucide-react";

import { CardArt } from "@/components/asset/card-art";
import { CountdownTimer } from "@/components/auction/countdown-timer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CARD_GAME_LABELS } from "@/lib/labels";
import { displayImage } from "@/lib/card-image";
import { formatDateTime, formatGrade, formatThb } from "@/lib/format";
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
      <DialogContent className="max-w-lg p-4 sm:p-6">
        <DialogTitle className="pr-8 text-base">{asset.name}</DialogTitle>
        <div className="card-stage relative mx-auto flex aspect-[3/4] max-h-[75vh] w-full items-center justify-center overflow-hidden rounded-xl">
          {art("lg")}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AuctionRow({ auction }: { auction: Auction }) {
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
              {t("Live")} · {t(CARD_GAME_LABELS[asset.game])}
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
          <span className="text-sm font-medium tabular-nums">{formatThb(auction.startPriceThb)}</span>
        </div>

        {/* Current bid + leader */}
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className={label}>{t("Current Bid")}</span>
          {auction.currentBidThb != null ? (
            <>
              <span className="text-success text-base font-bold tabular-nums">{formatThb(auction.currentBidThb)}</span>
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
              <span className="font-semibold tabular-nums">{formatThb(bid.amountThb)}</span>
            </span>
          ))}
        </div>
      )}
    </li>
  );
}

/** Live auctions as rows: card, prices, bids and time left all readable without opening one. */
export function AuctionList({ auctions }: { auctions: Auction[] }) {
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
