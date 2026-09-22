"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, PackageCheck, Repeat, Tag, TagX, Truck } from "lucide-react";

import { CardArt } from "@/components/asset/card-art";
import { Badge } from "@/components/ui/badge";
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
import { delistAsset, updateListingPrice, vaultRedeem, vaultRelist } from "@/lib/actions";
import { useWalletStore } from "@/lib/web3/wallet-store";
import { formatGrade, formatThb } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/labels";
import type { AssetSummary } from "@/lib/types";

export function PortfolioItemCard({
  asset,
  escrowAuthorityAddress,
}: {
  asset: AssetSummary;
  escrowAuthorityAddress: string | null;
}) {
  const router = useRouter();
  const { connected, connect, sendMemo, approveDelegate, revokeDelegate } = useWalletStore();
  const [relistOpen, setRelistOpen] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [priceEditOpen, setPriceEditOpen] = useState(false);
  const [price, setPrice] = useState(asset.priceThb ? String(asset.priceThb) : "");
  const [pending, startTransition] = useTransition();

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
        const tx = await signApprove(`Proof relist: ${asset.name} | ${Number(price)} THB`);
        await vaultRelist(asset.id, Number(price), tx);
        toast.success("Relisted for instant sale.");
        setRelistOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not relist item.");
      }
    });
  }

  function handleRedeem() {
    startTransition(async () => {
      try {
        await vaultRedeem(asset.id);
        toast.success("Redemption requested. Dispatching from the warehouse.");
        setRedeemOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not redeem item.");
      }
    });
  }

  function handleUpdatePrice() {
    startTransition(async () => {
      try {
        const tx = await signApprove(`Proof ${asset.forSale ? "reprice" : "list"}: ${asset.name} | ${Number(price)} THB`);
        await updateListingPrice(asset.id, Number(price), tx);
        toast.success(asset.forSale ? "Price updated." : "Listed for sale.");
        setPriceEditOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update listing.");
      }
    });
  }

  function handleDelist() {
    startTransition(async () => {
      try {
        const tx = await signRevoke(`Proof delist: ${asset.name}`);
        await delistAsset(asset.id, tx);
        toast.success("Delisted from the marketplace.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not delist item.");
      }
    });
  }

  const thumbnail = asset.verificationPhotos[0];

  return (
    <div className="bg-card flex flex-col gap-3 rounded-xl border p-3 shadow-sm">
      {/* The image bleeds to the card's own edges (negative margin,
          matching corner radius) instead of sitting in its own inset
          border — a separate inner frame read as "double framed". */}
      <Link href={`/item/${asset.id}`} className="relative -mx-3 -mt-3 block aspect-[3/4]">
        {thumbnail ? (
          <Image
            src={thumbnail.url}
            alt={asset.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw"
            className="rounded-t-xl object-cover"
          />
        ) : (
          <CardArt
            themeIndex={asset.themeIndex}
            category={asset.category}
            gradingCompany={asset.gradingCompany}
            grade={asset.grade}
            bordered={false}
            className="rounded-t-xl"
          />
        )}
        {thumbnail && (
          <span className="absolute left-2 top-2 rounded-full bg-foreground/90 px-2 py-0.5 text-[10px] font-semibold text-background backdrop-blur-sm">
            {asset.gradingCompany === "RAW" ? "RAW" : `${asset.gradingCompany} ${formatGrade(asset.grade)}`}
          </span>
        )}
      </Link>
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs">{CATEGORY_LABELS[asset.category]}</span>
        <Link href={`/item/${asset.id}`} className="line-clamp-1 text-sm font-semibold hover:underline">
          {asset.name}
        </Link>
        <p className="text-muted-foreground line-clamp-1 text-xs">{asset.subtitle}</p>
      </div>

      {asset.forSale && (
        <Badge variant="secondary" className="w-fit">
          Listed at {formatThb(asset.priceThb!)}
        </Badge>
      )}

      {asset.vaulted ? (
        <div className="flex gap-2 pt-1">
          <Dialog open={relistOpen} onOpenChange={setRelistOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="secondary" className="flex-1">
                <Repeat /> Relist
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Relist for Instant Sale</DialogTitle>
                <DialogDescription>
                  This item stays in the vault. A buyer can purchase it with
                  zero shipping — ownership transfers digitally and instantly.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                <Label htmlFor="relist-price">Price (THB)</Label>
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
                  Cancel
                </Button>
                <Button onClick={handleRelist} disabled={pending || !price || Number(price) <= 0}>
                  {pending && <Loader2 className="animate-spin" />}
                  Confirm Relist
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={redeemOpen} onOpenChange={setRedeemOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="flex-1">
                <Truck /> Redeem
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Redeem Physical Item</DialogTitle>
                <DialogDescription>
                  The warehouse will dispatch the physical item to your home
                  address on file. It will be removed from the vault and can
                  no longer be traded instantly.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRedeemOpen(false)} disabled={pending}>
                  Cancel
                </Button>
                <Button onClick={handleRedeem} disabled={pending}>
                  {pending ? <Loader2 className="animate-spin" /> : <PackageCheck />}
                  Confirm Redemption
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      ) : asset.marketStatus === "IN_ESCROW" ? (
        <p className="text-muted-foreground pt-1 text-xs">Locked in an active sale.</p>
      ) : (
        <div className="flex gap-2 pt-1">
          <Dialog open={priceEditOpen} onOpenChange={setPriceEditOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="secondary" className="flex-1">
                <Tag /> {asset.forSale ? "Edit Price" : "List for Sale"}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{asset.forSale ? "Update Listing Price" : "List for Sale"}</DialogTitle>
                <DialogDescription>
                  {asset.forSale
                    ? "Changes the price buyers see on the marketplace right away."
                    : "Puts this item back on the marketplace at the price you set."}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                <Label htmlFor="price-edit">Price (THB)</Label>
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
                  Cancel
                </Button>
                <Button onClick={handleUpdatePrice} disabled={pending || !price || Number(price) <= 0}>
                  {pending && <Loader2 className="animate-spin" />}
                  {asset.forSale ? "Update Price" : "List for Sale"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {asset.forSale && (
            <Button size="sm" variant="outline" className="flex-1" onClick={handleDelist} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <TagX />}
              Delist
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
