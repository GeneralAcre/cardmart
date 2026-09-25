"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftRight, Check, Loader2, Repeat, X } from "lucide-react";
import type { AssetCategory, GradingCompany, TradeOfferStatus } from "@prisma/client";

import { CardArt } from "@/components/asset/card-art";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTradeSigning } from "@/components/trade/use-trade-signing";
import { respondToTrade, withdrawTrade } from "@/lib/actions";
import { formatDateTime, formatGrade, formatThb } from "@/lib/format";
import { TRADE_OFFER_STATUS_LABELS } from "@/lib/labels";

interface TradeCard {
  id: string;
  name: string;
  gradingCompany: GradingCompany;
  grade: number | null;
  isBlackLabel: boolean;
  themeIndex: number;
  category: AssetCategory;
  mintAddress: string | null;
  verificationPhotos: { url: string }[];
}

interface TradeParty {
  id: string;
  name: string | null;
  handle: string | null;
  walletAddress: string | null;
}

export interface TradeOfferRow {
  id: string;
  cashThb: number;
  message: string | null;
  status: TradeOfferStatus;
  createdAt: Date;
  proposer: TradeParty;
  recipient: TradeParty;
  requestedAsset: TradeCard;
  offeredAsset: TradeCard;
}

function partyName(p: TradeParty) {
  return p.name ?? (p.handle ? `@${p.handle}` : "A collector");
}

export function TradesPanel({
  received,
  sent,
  escrowAuthorityAddress,
}: {
  received: TradeOfferRow[];
  sent: TradeOfferRow[];
  escrowAuthorityAddress: string | null;
}) {
  const pendingReceived = received.filter((t) => t.status === "PENDING");
  const pastReceived = received.filter((t) => t.status !== "PENDING");

  return (
    <div className="flex flex-col gap-8">
      <p className="text-muted-foreground max-w-2xl text-sm">
        Swap a vaulted card for another collector&apos;s vaulted card, with optional cash either way. Open any
        vaulted item and choose <span className="text-foreground font-medium">Propose a Swap</span> to start one.
      </p>

      <section>
        <h3 className="mb-3 text-sm font-semibold">Proposals for you ({pendingReceived.length})</h3>
        {pendingReceived.length === 0 ? (
          <p className="text-muted-foreground text-sm">No swap proposals waiting for you.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {pendingReceived.map((t) => (
              <TradeRow key={t.id} trade={t} perspective="received" escrowAuthorityAddress={escrowAuthorityAddress} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold">Your proposals ({sent.length})</h3>
        {sent.length === 0 ? (
          <p className="text-muted-foreground text-sm">You haven&apos;t proposed any swaps yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {sent.map((t) => (
              <TradeRow key={t.id} trade={t} perspective="sent" escrowAuthorityAddress={escrowAuthorityAddress} />
            ))}
          </div>
        )}
      </section>

      {pastReceived.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold">Past proposals for you</h3>
          <div className="flex flex-col gap-3">
            {pastReceived.map((t) => (
              <TradeRow key={t.id} trade={t} perspective="received" escrowAuthorityAddress={escrowAuthorityAddress} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CardThumb({ card, caption }: { card: TradeCard; caption: string }) {
  const photo = card.verificationPhotos[0];
  return (
    <Link href={`/item/${card.id}`} className="flex min-w-0 flex-1 items-center gap-3 hover:underline">
      <div className="relative aspect-[3/4] w-12 shrink-0 overflow-hidden rounded-md border">
        {photo ? (
          <Image src={photo.url} alt={card.name} fill sizes="48px" className="object-cover" />
        ) : (
          <CardArt
            themeIndex={card.themeIndex}
            category={card.category}
            gradingCompany={card.gradingCompany}
            grade={card.grade}
            isBlackLabel={card.isBlackLabel}
            bordered={false}
          />
        )}
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="text-muted-foreground text-[11px] uppercase tracking-wide">{caption}</span>
        <span className="truncate text-sm font-semibold">{card.name}</span>
        <span className="text-muted-foreground text-xs">
          {card.gradingCompany === "RAW" ? "Raw" : `${card.gradingCompany} ${formatGrade(card.grade)}`}
          {card.isBlackLabel && " · Black Label"}
        </span>
      </div>
    </Link>
  );
}

function TradeRow({
  trade,
  perspective,
  escrowAuthorityAddress,
}: {
  trade: TradeOfferRow;
  perspective: "received" | "sent";
  escrowAuthorityAddress: string | null;
}) {
  const router = useRouter();
  const { ensureConnected, approveCard, lockCash } = useTradeSigning();
  const [pending, setPending] = useState<null | "accept" | "reject" | "withdraw">(null);

  const youGive = perspective === "received" ? trade.requestedAsset : trade.offeredAsset;
  const youGet = perspective === "received" ? trade.offeredAsset : trade.requestedAsset;
  const other = perspective === "received" ? trade.proposer : trade.recipient;

  // Cash from the viewer's point of view: positive = they receive it.
  const proposerPays = trade.cashThb > 0;
  const cash = Math.abs(trade.cashThb);
  const viewerReceivesCash = perspective === "received" ? proposerPays : !proposerPays;
  const cashText =
    trade.cashThb === 0
      ? null
      : viewerReceivesCash
        ? `+ you receive ${formatThb(cash)}`
        : `+ you pay ${formatThb(cash)}`;

  async function accept() {
    setPending("accept");
    try {
      await ensureConnected();
      const approveTxSignature = await approveCard(trade.requestedAsset.mintAddress, escrowAuthorityAddress);
      let cashLock;
      if (trade.cashThb < 0) {
        try {
          cashLock = await lockCash(cash, trade.proposer.walletAddress);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not lock your cash. Try again.");
          return;
        }
      }
      await respondToTrade(trade.id, "accept", { approveTxSignature, cashLock });
      toast.success("Swap complete — the new card is in your vault.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not accept swap.");
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  async function run(kind: "reject" | "withdraw") {
    setPending(kind);
    try {
      if (kind === "reject") await respondToTrade(trade.id, "reject");
      else await withdrawTrade(trade.id);
      toast.success(kind === "reject" ? "Swap declined." : "Proposal withdrawn.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="bg-card flex flex-col gap-3 rounded-xl border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs">
          {perspective === "received" ? `From ${partyName(other)}` : `To ${partyName(other)}`} ·{" "}
          {formatDateTime(trade.createdAt)}
        </span>
        <Badge variant={trade.status === "ACCEPTED" ? "default" : "outline"}>
          <Repeat className="size-3" /> {TRADE_OFFER_STATUS_LABELS[trade.status]}
        </Badge>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <CardThumb card={youGive} caption="You give" />
        <ArrowLeftRight className="text-muted-foreground mx-auto size-4 shrink-0 rotate-90 sm:rotate-0" />
        <CardThumb card={youGet} caption="You get" />
      </div>

      {cashText && (
        <p className={viewerReceivesCash ? "text-success text-sm font-medium" : "text-sm font-medium"}>{cashText}</p>
      )}
      {trade.message && <p className="text-muted-foreground text-xs italic">&ldquo;{trade.message}&rdquo;</p>}

      {trade.status === "PENDING" && (
        <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
          {perspective === "received" ? (
            <>
              <Button size="sm" variant="outline" onClick={() => run("reject")} disabled={pending !== null}>
                {pending === "reject" ? <Loader2 className="animate-spin" /> : <X />}
                Decline
              </Button>
              <Button size="sm" onClick={accept} disabled={pending !== null}>
                {pending === "accept" ? <Loader2 className="animate-spin" /> : <Check />}
                Accept Swap
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => run("withdraw")} disabled={pending !== null}>
              {pending === "withdraw" ? <Loader2 className="animate-spin" /> : <X />}
              Withdraw
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
