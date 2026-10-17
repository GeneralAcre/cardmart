"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { History, Loader2, Pencil, Plus, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { setPurchaseCost } from "@/lib/actions";
import { formatDate, formatGrade, formatThb } from "@/lib/format";
import type { HoldingPnl, SoldTrade } from "@/lib/pnl";
import { cn } from "@/lib/utils";
import { useT } from "@/components/landing/language-provider";

// Green for a gain, red for a loss, grey when it's flat.
const toneClass = (v: number) => (v > 0 ? "text-success" : v < 0 ? "text-destructive" : "text-muted-foreground");

/** "▲ 12.3%" in green, "▼ 4.0%" in red, or a grey "0.0%". */
function GainBadge({ pct, className }: { pct: number; className?: string }) {
  const flat = Math.abs(pct) < 0.05;
  return (
    <span className={cn("font-semibold tabular-nums", toneClass(flat ? 0 : pct), className)}>
      {flat ? "" : pct > 0 ? "▲ " : "▼ "}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

const signedThb = (v: number) => (v === 0 ? formatThb(0) : `${v > 0 ? "+" : "−"}${formatThb(Math.abs(v))}`);

/** Lets the owner enter, change or clear what they paid for a card. */
function PurchaseCostDialog({
  assetId,
  costThb,
  children,
}: {
  assetId: string;
  costThb: number | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(costThb != null ? String(costThb) : "");
  const [pending, startTransition] = useTransition();

  function save(next: number | null) {
    startTransition(async () => {
      try {
        await setPurchaseCost(assetId, next);
        toast.success(next == null ? t("Price removed.") : t("Saved what you paid."));
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("Could not save."));
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setValue(costThb != null ? String(costThb) : "");
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("What did you pay?")}</DialogTitle>
          <DialogDescription>
            {t("For a card you didn't buy on CardMart. It's only used to show your profit or loss, and only you can see it.")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`cost-${assetId}`}>{t("Price paid (THB)")}</Label>
          <Input
            id={`cost-${assetId}`}
            type="number"
            inputMode="numeric"
            min={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={pending}
          />
        </div>
        <DialogFooter>
          {costThb != null && (
            <Button variant="ghost" className="sm:mr-auto" onClick={() => save(null)} disabled={pending}>
              {t("Remove")}
            </Button>
          )}
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            {t("Cancel")}
          </Button>
          <Button onClick={() => save(Number(value))} disabled={pending || !value || Number(value) <= 0}>
            {pending && <Loader2 className="animate-spin" />}
            {t("Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * A held card's profit or loss: the change as the headline, then what was
 * paid against the market price now. Without a market price there's no
 * profit figure yet, just what was paid.
 */
export function HoldingPnlBlock({ assetId, pnl }: { assetId: string; pnl: HoldingPnl | undefined }) {
  const t = useT();
  if (!pnl) return null;

  if (pnl.costThb == null) {
    return (
      <PurchaseCostDialog assetId={assetId} costThb={null}>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground inline-flex size-6 shrink-0 items-center justify-center rounded-full transition-colors"
          aria-label={t("Add what you paid to see profit")}
          title={t("Add what you paid to see profit")}
        >
          <Plus className="size-4" />
        </button>
      </PurchaseCostDialog>
    );
  }

  // Just the percentage on the card; the prices behind it are on the card's
  // page (and in the hover text), so the grid stays easy to scan.
  return (
    <div
      className="flex shrink-0 items-center"
      title={
        pnl.valueThb != null
          ? t("Paid {paid} · Market {market}", { paid: formatThb(pnl.costThb), market: formatThb(pnl.valueThb) })
          : t("Paid {paid}", { paid: formatThb(pnl.costThb) })
      }
    >
      <span className="flex items-center">
        {pnl.costSource === "manual" ? (
          <PurchaseCostDialog assetId={assetId} costThb={pnl.costThb}>
            <button type="button" className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={t("Edit what you paid")}>
              {pnl.gainPct != null ? (
                <GainBadge pct={pnl.gainPct} className="text-base" />
              ) : (
                <span className="text-muted-foreground text-sm" aria-hidden="true">—</span>
              )}
            </button>
          </PurchaseCostDialog>
        ) : pnl.gainPct != null ? (
          <GainBadge pct={pnl.gainPct} className="text-base" />
        ) : (
          <span className="text-muted-foreground text-sm" title={t("No market price yet")}>—</span>
        )}
      </span>
    </div>
  );
}

/** Every card the user has sold: paid, sold for, and the profit or loss on each. */
export function TradeHistory({ trades }: { trades: SoldTrade[] }) {
  const t = useT();

  if (trades.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-24 text-center">
        <History className="size-8" />
        <p className="text-sm">{t("No sales yet. Cards you sell show up here with your profit or loss.")}</p>
      </div>
    );
  }

  const known = trades.filter((tr) => tr.gainThb != null);
  const totalGain = known.reduce((sum, tr) => sum + tr.gainThb!, 0);
  const totalCost = known.reduce((sum, tr) => sum + tr.costThb!, 0);
  const totalSold = trades.reduce((sum, tr) => sum + tr.soldThb, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3">
        <div className="bg-card flex flex-col gap-0.5 p-4">
          <span className="text-muted-foreground text-xs">{t("Cards sold")}</span>
          <span className="text-xl font-bold tabular-nums">{trades.length}</span>
        </div>
        <div className="bg-card flex flex-col gap-0.5 p-4">
          <span className="text-muted-foreground text-xs">{t("Total sales")}</span>
          <span className="text-xl font-bold tabular-nums">{formatThb(totalSold)}</span>
        </div>
        <div className="bg-card flex flex-col gap-0.5 p-4">
          <span className="text-muted-foreground text-xs">{t("Profit / loss")}</span>
          {known.length > 0 ? (
            <span className="flex items-baseline gap-2">
              <span className={cn("text-xl font-bold tabular-nums", toneClass(totalGain))}>
                {signedThb(totalGain)}
              </span>
              {totalCost > 0 && <GainBadge pct={(totalGain / totalCost) * 100} className="text-sm" />}
            </span>
          ) : (
            <span className="text-muted-foreground text-sm">{t("Add what you paid to see it")}</span>
          )}
          {known.length > 0 && known.length < trades.length && (
            <span className="text-muted-foreground text-[11px]">
              {t("From {count} of {total} sales with a known cost", { count: known.length, total: trades.length })}
            </span>
          )}
        </div>
      </div>

      <ul className="bg-card divide-y rounded-xl border">
        {trades.map((tr) => (
          <li key={tr.escrowId} className="flex items-center gap-3 p-3">
            <Link href={`/item/${tr.assetId}`} className="card-stage relative h-16 w-12 shrink-0 overflow-hidden rounded-md">
              {tr.photoUrl && <Image src={tr.photoUrl} alt="" fill sizes="48px" className="object-contain p-0.5" />}
            </Link>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <Link href={`/item/${tr.assetId}`} className="truncate text-sm font-medium hover:underline">
                {tr.name}
              </Link>
              <span className="text-muted-foreground truncate text-xs">
                {tr.gradingCompany === "RAW" ? t("Ungraded") : `${tr.gradingCompany} ${formatGrade(tr.grade)}`}
                {tr.isBlackLabel && " · Black Label"} · {t("Sold {date}", { date: formatDate(tr.soldAt) })}
              </span>
              <span className="text-muted-foreground flex items-center gap-1 text-xs">
                {tr.costThb != null ? (
                  <>
                    {t("Paid")} <span className="text-foreground tabular-nums">{formatThb(tr.costThb)}</span>
                    {tr.costSource === "manual" && (
                      <PurchaseCostDialog assetId={tr.assetId} costThb={tr.costThb}>
                        <button type="button" className="hover:text-foreground" aria-label={t("Edit what you paid")}>
                          <Pencil className="size-3" />
                        </button>
                      </PurchaseCostDialog>
                    )}
                  </>
                ) : (
                  <PurchaseCostDialog assetId={tr.assetId} costThb={null}>
                    <button type="button" className="hover:text-foreground flex items-center gap-1 underline-offset-2 hover:underline">
                      <Plus className="size-3" /> {t("Add what you paid")}
                    </button>
                  </PurchaseCostDialog>
                )}
              </span>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
              <span className="text-sm font-semibold tabular-nums">{formatThb(tr.soldThb)}</span>
              {tr.gainPct != null && tr.gainThb != null ? (
                <span className="flex items-center gap-1.5 text-xs">
                  <span className={cn("tabular-nums", toneClass(tr.gainThb))}>
                    {signedThb(tr.gainThb)}
                  </span>
                  <GainBadge pct={tr.gainPct} />
                </span>
              ) : (
                <span className="text-muted-foreground text-xs">—</span>
              )}
            </div>
            <Button asChild variant="ghost" size="icon" className="text-muted-foreground size-8 shrink-0">
              <Link href={`/share/trade/${tr.escrowId}`} aria-label={t("Share this sale")} title={t("Share this sale")}>
                <Share2 />
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
