import Image from "next/image";
import Link from "next/link";
import { Gavel } from "lucide-react";

import { CardArt } from "@/components/asset/card-art";
import { CountdownTimer } from "@/components/auction/countdown-timer";
import { CARD_GAME_LABELS } from "@/lib/labels";
import { formatThb } from "@/lib/format";
import type { getActiveAuctions } from "@/lib/queries";

export function AuctionCard({ auction }: { auction: Awaited<ReturnType<typeof getActiveAuctions>>[number] }) {
  const { asset } = auction;
  const photo = asset.verificationPhotos[0];

  return (
    <Link
      href={`/auctions/${auction.id}`}
      className="group focus-visible:ring-ring rounded-xl outline-none focus-visible:ring-2"
    >
      <div className="bg-card flex flex-col gap-3 overflow-hidden rounded-xl border shadow-sm transition-shadow group-hover:shadow-md">
        <div className="relative aspect-[3/4]">
          {photo ? (
            <Image
              src={photo.url}
              alt={asset.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw"
              className="object-cover"
            />
          ) : (
            <CardArt
              themeIndex={asset.themeIndex}
              category={asset.category}
              gradingCompany={asset.gradingCompany}
              grade={asset.grade}
              isBlackLabel={asset.isBlackLabel}
              bordered={false}
            />
          )}
          <span className="bg-foreground text-background absolute right-2 top-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold">
            <Gavel className="size-3" />
            <CountdownTimer endTime={auction.endTime.toISOString()} />
          </span>
        </div>
        <div className="flex flex-col gap-3 px-3 pb-3">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">{CARD_GAME_LABELS[asset.game]}</span>
            <h3 className="line-clamp-1 text-sm font-semibold">{asset.name}</h3>
            <p className="text-muted-foreground line-clamp-1 text-xs">{asset.subtitle}</p>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground text-[10px] uppercase tracking-wide">
              {auction.currentBidThb != null ? "Current Bid" : "Starting Bid"}
            </span>
            <span className="text-lg font-bold tabular-nums">
              {formatThb(auction.currentBidThb ?? auction.startPriceThb)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
