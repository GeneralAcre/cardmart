"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, PackageCheck, Repeat, Truck } from "lucide-react";

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
import { vaultRedeem, vaultRelist } from "@/lib/actions";
import { formatThb } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/labels";
import type { AssetSummary } from "@/lib/types";

export function PortfolioItemCard({ asset }: { asset: AssetSummary }) {
  const router = useRouter();
  const [relistOpen, setRelistOpen] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [price, setPrice] = useState(asset.priceThb ? String(asset.priceThb) : "");
  const [pending, startTransition] = useTransition();

  function handleRelist() {
    startTransition(async () => {
      try {
        await vaultRelist(asset.id, Number(price));
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

  const thumbnail = asset.verificationPhotos[0];

  return (
    <div className="bg-card flex flex-col gap-3 rounded-xl border p-3 shadow-sm">
      <Link href={`/item/${asset.id}`}>
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnail.url}
            alt={asset.name}
            className="aspect-[3/4] w-full rounded-lg border object-cover"
          />
        ) : (
          <CardArt
            themeIndex={asset.themeIndex}
            category={asset.category}
            gradingCompany={asset.gradingCompany}
            grade={asset.grade}
          />
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
      ) : (
        <p className="text-muted-foreground pt-1 text-xs">Physically in your hands.</p>
      )}
    </div>
  );
}
