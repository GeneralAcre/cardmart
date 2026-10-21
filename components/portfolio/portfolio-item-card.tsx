"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Flame, Gavel, Loader2, Repeat, Tag, TagX, Truck } from "lucide-react";

import { CardArt } from "@/components/asset/card-art";
import { BidStepField, resolveBidStep } from "@/components/auction/bid-step-field";
import { StartTimePicker } from "@/components/auction/start-time-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { auctionApprovalNeeded, delistAsset, startAuction, updateListingPrice, prepareVaultRedeem, vaultRedeem, vaultRelist } from "@/lib/actions";
import { useWalletStore } from "@/lib/web3/wallet-store";
import { formatGrade, formatThb } from "@/lib/format";
import { RarityTag } from "@/components/item/rarity-badge";
import type { AssetSummary } from "@/lib/types";
import { displayImage } from "@/lib/card-image";
import { useT } from "@/components/landing/language-provider";
import { GainBadge, HoldingPnlBlock } from "@/components/portfolio/pnl";
import type { HoldingPnl } from "@/lib/pnl";

export function PortfolioItemCard({
  asset,
  escrowAuthorityAddress,
  shipping,
  pnl,
}: {
  asset: AssetSummary;
  /** What the owner paid against what the card is worth now (lib/pnl.ts). */
  pnl?: HoldingPnl;
  escrowAuthorityAddress: string | null;
  /** The owner's saved shipping details, pre-filled into the redeem dialog. */
  shipping: { address: string | null; phone: string | null };
}) {
  const router = useRouter();
  const { connected, connect, sendMemo, approveDelegate, revokeDelegate, burnDigitalTwin } = useWalletStore();
  const [relistOpen, setRelistOpen] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeemAddress, setRedeemAddress] = useState(shipping.address ?? "");
  const [redeemPhone, setRedeemPhone] = useState(shipping.phone ?? "");
  const redeemShippingValid = redeemAddress.trim().length >= 10 && redeemPhone.trim().length >= 6;
  const [priceEditOpen, setPriceEditOpen] = useState(false);
  const [auctionOpen, setAuctionOpen] = useState(false);
  const [price, setPrice] = useState(asset.priceThb ? String(asset.priceThb) : "");
  const [auctionStartPrice, setAuctionStartPrice] = useState(asset.priceThb ? String(asset.priceThb) : "");
  const [auctionBidStep, setAuctionBidStep] = useState("");
  const [auctionDurationDays, setAuctionDurationDays] = useState("3");
  const [auctionStartTime, setAuctionStartTime] = useState("");
  const [pending, startTransition] = useTransition();
  const t = useT();

  // A real Approve (delegating the escrow authority as a 1-token spender)
  // whenever this asset has a real digital-twin mint — this is what
  // actually lets the platform complete a transfer if it sells. Falls back
  // to a Memo signature for legacy assets minted before this existed.
  // Returns undefined (not a hard failure) on any signing error, so the
  // action falls back to a simulated signature instead of blocking the
  // seller entirely.
  async function signApprove(memoFallback: string): Promise<string | undefined> {
    try {
      if (!connected) await connect();
      if (asset.mintAddress && escrowAuthorityAddress) {
        return await approveDelegate(asset.mintAddress, escrowAuthorityAddress);
      }
      return await sendMemo(memoFallback);
    } catch {
      return undefined;
    }
  }

  // Real Revoke on delist, closing the window where a delisted item could
  // still be moved by the platform. Same legacy fallback as signApprove.
  async function signRevoke(memoFallback: string): Promise<string | undefined> {
    try {
      if (!connected) await connect();
      if (asset.mintAddress) {
        return await revokeDelegate(asset.mintAddress);
      }
      return await sendMemo(memoFallback);
    } catch {
      return undefined;
    }
  }

  function handleRelist() {
    startTransition(async () => {
      try {
        const tx = await signApprove(`CardMart relist: ${asset.name} | ${Number(price)} THB`);
        await vaultRelist(asset.id, Number(price), tx);
        toast.success(t("Relisted for instant sale."));
        setRelistOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("Could not relist item."));
      }
    });
  }

  // Redeeming burns the digital twin, since the physical card is leaving the
  // vault. For a real mint the owner signs the burn themselves; if signing
  // fails, the server still refuses the redeem when the token is really in
  // their wallet (see vaultRedeem), so a card can never leave with its twin
  // still tradeable.
  function handleRedeem() {
    startTransition(async () => {
      try {
        // Saves the address and re-checks the item BEFORE the burn — the
        // burn can't be undone, so nothing may fail after it.
        await prepareVaultRedeem(asset.id, { shippingAddress: redeemAddress, phone: redeemPhone });
        let burnTx: string | undefined;
        if (asset.mintAddress) {
          try {
            if (!connected) await connect();
            burnTx = await burnDigitalTwin(asset.mintAddress);
          } catch {
            burnTx = undefined;
          }
        }
        await vaultRedeem(asset.id, burnTx);
        toast.success(t("Redeemed — digital twin burned and the card is on its way to you."));
        setRedeemOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("Could not redeem item."));
      }
    });
  }

  function handleUpdatePrice() {
    startTransition(async () => {
      try {
        const tx = await signApprove(`CardMart ${asset.forSale ? "reprice" : "list"}: ${asset.name} | ${Number(price)} THB`);
        await updateListingPrice(asset.id, Number(price), tx);
        toast.success(asset.forSale ? t("Price updated.") : t("Listed for sale."));
        setPriceEditOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("Could not update listing."));
      }
    });
  }

  function handleDelist() {
    startTransition(async () => {
      try {
        const tx = await signRevoke(`CardMart delist: ${asset.name}`);
        await delistAsset(asset.id, tx);
        toast.success(t("Delisted from the marketplace."));
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("Could not delist item."));
      }
    });
  }

  function handleStartAuction() {
    startTransition(async () => {
      try {
        // The winner's NFT must be movable when the auction ends.
        if (await auctionApprovalNeeded(asset.id)) await signApprove(`CardMart auction: ${asset.name}`);
        await startAuction(
          asset.id,
          Number(auctionStartPrice),
          resolveBidStep(auctionBidStep, auctionStartPrice),
          Number(auctionDurationDays),
          auctionStartTime ? new Date(auctionStartTime).toISOString() : undefined,
        );
        toast.success(auctionStartTime ? t("Auction scheduled.") : t("Auction started."));
        setAuctionOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("Could not start auction."));
      }
    });
  }

  const startAuctionButton = (
    <Button size="sm" variant="outline" className="w-full" onClick={() => setAuctionOpen(true)}>
      <Gavel /> {t("Start Auction")}
    </Button>
  );

  const startAuctionDialog = (
    <Dialog open={auctionOpen} onOpenChange={setAuctionOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Start an Auction")}</DialogTitle>
          <DialogDescription>
            {t("Replaces any fixed-price listing on this item. Bidding is separate from the marketplace — see /auctions once it's live.")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="auction-start-price">{t("Starting Price (THB)")}</Label>
            <Input
              id="auction-start-price"
              type="number"
              inputMode="numeric"
              value={auctionStartPrice}
              onChange={(e) => setAuctionStartPrice(e.target.value)}
            />
          </div>
          <BidStepField id="auction-bid-step" value={auctionBidStep} onChange={setAuctionBidStep} startPrice={auctionStartPrice} />
          <div className="flex flex-col gap-2">
            <Label>{t("Duration")}</Label>
            <Select value={auctionDurationDays} onValueChange={setAuctionDurationDays}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">{t("1 day")}</SelectItem>
                <SelectItem value="3">{t("{days} days", { days: 3 })}</SelectItem>
                <SelectItem value="7">{t("{days} days", { days: 7 })}</SelectItem>
                <SelectItem value="14">{t("{days} days", { days: 14 })}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t("Start time")}</Label>
            <StartTimePicker value={auctionStartTime} onChange={setAuctionStartTime} />
            <p className="text-muted-foreground text-xs">{t("You can schedule up to 30 days ahead.")}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAuctionOpen(false)} disabled={pending}>
            {t("Cancel")}
          </Button>
          <Button
            onClick={handleStartAuction}
            disabled={pending || !auctionStartPrice || Number(auctionStartPrice) <= 0}
          >
            {pending && <Loader2 className="animate-spin" />}
            {t("Start Auction")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const thumbnail = displayImage(asset);

  return (
    // @container: the actions below size to this card, not the screen, so they
    // fit whether the grid shows 2 cards (phones) or 6 (wide desktops).
    <div className="bg-card @container relative flex flex-col gap-3 rounded-2xl border p-3 shadow-sm">
      {/* Same treatment as the Market cards: the whole card shown on a dark
          spotlight stage (contain, with padding) instead of cropped to fill. */}
      <Link href={`/item/${asset.id}`} className="card-stage relative -mx-3 -mt-3 block aspect-[4/5] overflow-hidden rounded-t-2xl">
        {thumbnail ? (
          <Image
            src={thumbnail.url}
            alt={asset.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw"
            className="object-contain p-4 photo-shadow sm:p-5"
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
              className="h-full w-auto rounded-lg"
            />
          </div>
        )}
        {/* The grade in the picture's corner, the same dark chip as on the Market cards. */}
        <span className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-md bg-black/70 px-2 py-1.5 text-[11px] leading-none text-white backdrop-blur-sm">
          {asset.gradingCompany === "RAW" ? (
            <span className="font-semibold">{t("Ungraded")}</span>
          ) : (
            <>
              <span className="text-white/70">{asset.gradingCompany}</span>
              <span className="font-bold">{formatGrade(asset.grade)}</span>
            </>
          )}
          {asset.isBlackLabel && <span className="font-semibold text-amber-500">· BL</span>}
        </span>
        {/* Top-right corner: whether it's on the market, in words, matching the grade chip. */}
        {asset.marketStatus === "IN_AUCTION" ? (
          <span className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-md bg-black/70 px-2 py-1.5 text-[11px] leading-none font-semibold text-white backdrop-blur-sm">
            <Gavel className="size-3" /> {t("Up for Auction")}
          </span>
        ) : (
          asset.forSale && (
            <span
              className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-md bg-black/70 px-2 py-1.5 text-[11px] leading-none font-semibold text-white tabular-nums backdrop-blur-sm"
              title={t("Listed at {price}", { price: formatThb(asset.priceThb!) })}
            >
              <Tag className="size-3" /> {formatThb(asset.priceThb!)}
            </span>
          )
        )}
      </Link>
      <div className="flex flex-col gap-1">
        {/* Name on the left; the rarity and sale status beside it on the right. */}
        <div className="flex min-w-0 items-center justify-between gap-2">
          <Link href={`/item/${asset.id}`} className="min-w-0 truncate text-sm font-semibold hover:underline">
            {asset.name}
          </Link>
          {asset.rarity && <RarityTag rarity={asset.rarity} />}
        </div>
        <p className="text-muted-foreground line-clamp-1 text-xs">{asset.subtitle}</p>
      </div>

      {/* The gain comes first: the amount on the right, never cut off, and the
          same move as a percentage on the left. */}
      {pnl && (
        <div className="flex min-h-7 items-center justify-between gap-2">
          {pnl.gainPct != null && <GainBadge pct={pnl.gainPct} className="text-sm" />}
          <span className="ml-auto flex min-w-0 justify-end">
            <HoldingPnlBlock assetId={asset.id} pnl={pnl} />
          </span>
        </div>
      )}

      {asset.marketStatus === "IN_AUCTION" ? (
        <div className="mt-auto pt-1">
          <Button asChild size="sm" variant="default" className="w-full font-semibold">
            <Link href={`/item/${asset.id}`}>{t("View auction")}</Link>
          </Button>
        </div>
      ) : asset.vaulted ? (
        <div className="mt-auto pt-1">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="default" className="w-full font-semibold">
                {t("Manage")} <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuItem onSelect={() => setRelistOpen(true)}>
                <Repeat /> {t("Relist")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setRedeemOpen(true)}>
                <Truck /> {t("Redeem")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setAuctionOpen(true)}>
                <Gavel /> {t("Start Auction")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <>
            <Dialog open={relistOpen} onOpenChange={setRelistOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("Relist for Instant Sale")}</DialogTitle>
                  <DialogDescription>
                    {t("This item stays in the vault. A buyer can purchase it with zero shipping — ownership transfers digitally and instantly.")}
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="relist-price">{t("Price (THB)")}</Label>
                  <Input
                    id="relist-price"
                    type="number"
                    inputMode="numeric"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setRelistOpen(false)} disabled={pending}>
                    {t("Cancel")}
                  </Button>
                  <Button onClick={handleRelist} disabled={pending || !price || Number(price) <= 0}>
                    {pending && <Loader2 className="animate-spin" />}
                    {t("Confirm Relist")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={redeemOpen} onOpenChange={setRedeemOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("Redeem Physical Item")}</DialogTitle>
                  <DialogDescription>
                    {t("The warehouse ships the physical card to the address below, and its digital twin is burned for good.")}
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`redeem-address-${asset.id}`}>{t("Shipping Address")}</Label>
                  <Textarea
                    id={`redeem-address-${asset.id}`}
                    value={redeemAddress}
                    onChange={(e) => setRedeemAddress(e.target.value)}
                    placeholder={t("Street, city, postal code — where we'll send physical items")}
                    disabled={pending}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`redeem-phone-${asset.id}`}>{t("Phone Number")}</Label>
                  <Input
                    id={`redeem-phone-${asset.id}`}
                    type="tel"
                    value={redeemPhone}
                    onChange={(e) => setRedeemPhone(e.target.value)}
                    placeholder={t("For the courier to reach you")}
                    disabled={pending}
                  />
                </div>
                <ul className="text-muted-foreground flex list-disc flex-col gap-1 pl-5 text-sm">
                  <li>{t("You'll sign one wallet transaction that burns the token.")}</li>
                  <li>{t("The card can't be listed, auctioned or swapped on CardMart afterwards.")}</li>
                  <li>{t("Redeeming is final — there's no refund once the token is burned.")}</li>
                  <li>{t("Any open swap proposals for it are closed and refunded.")}</li>
                </ul>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setRedeemOpen(false)} disabled={pending}>
                    {t("Cancel")}
                  </Button>
                  <Button onClick={handleRedeem} disabled={pending || !redeemShippingValid}>
                    {pending ? <Loader2 className="animate-spin" /> : <Flame />}
                    {t("Burn & Redeem")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
          {startAuctionDialog}
        </div>
      ) : asset.marketStatus === "IN_ESCROW" ? (
        <p className="text-muted-foreground mt-auto pt-1 text-xs">{t("Locked in an active sale.")}</p>
      ) : (
        <div className="flex flex-col gap-2 mt-auto pt-1">
          <div className="grid grid-cols-1 gap-2">
            <Dialog open={priceEditOpen} onOpenChange={setPriceEditOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary" className="w-full">
                  <Tag /> {asset.forSale ? t("Edit Price") : t("List for Sale")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{asset.forSale ? t("Update Listing Price") : t("List for Sale")}</DialogTitle>
                  <DialogDescription>
                    {asset.forSale
                      ? t("Changes the price buyers see on the marketplace right away.")
                      : t("Puts this item back on the marketplace at the price you set.")}
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="price-edit">{t("Price (THB)")}</Label>
                  <Input
                    id="price-edit"
                    type="number"
                    inputMode="numeric"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setPriceEditOpen(false)} disabled={pending}>
                    {t("Cancel")}
                  </Button>
                  <Button onClick={handleUpdatePrice} disabled={pending || !price || Number(price) <= 0}>
                    {pending && <Loader2 className="animate-spin" />}
                    {asset.forSale ? t("Update Price") : t("List for Sale")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {asset.forSale && (
              <Button size="sm" variant="outline" className="w-full" onClick={handleDelist} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <TagX />}
                {t("Delist")}
              </Button>
            )}
          </div>
          {startAuctionButton}
          {startAuctionDialog}
        </div>
      )}
    </div>
  );
}
