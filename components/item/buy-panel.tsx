"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Landmark, Loader2, ShieldCheck, Tag, Truck } from "lucide-react";
import type { MarketStatus } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buyListing, updateListingPrice } from "@/lib/actions";
import { useWalletStore } from "@/lib/web3/wallet-store";
import { useEscrowLock, type EscrowLock } from "@/lib/web3/use-escrow-lock";
import { formatThb } from "@/lib/format";
import { useT } from "@/components/landing/language-provider";

interface BuyPanelProps {
  assetId: string;
  assetName: string;
  priceThb: number | null;
  forSale: boolean;
  vaulted: boolean;
  marketStatus: MarketStatus;
  isOwner: boolean;
  /** The current owner's real wallet address — null for demo/mock wallets, in which case escrow stays simulated. */
  sellerWalletAddress: string | null;
}

// The default active tab (bg-background) is almost the same black as the
// track in dark mode, so the chosen delivery option gets a solid fill.
const ACTIVE_TAB_CLASS = "data-[state=active]:bg-foreground data-[state=active]:text-background";

export function BuyPanel({
  assetId,
  assetName,
  priceThb,
  forSale,
  vaulted,
  marketStatus,
  isOwner,
  sellerWalletAddress,
}: BuyPanelProps) {
  const router = useRouter();
  const { lock, connecting } = useEscrowLock();
  const t = useT();

  const [fulfillment, setFulfillment] = useState<"SHIP" | "VAULT">("SHIP");
  const [open, setOpen] = useState(false);
  const [signing, setSigning] = useState(false);
  const [submitting, startSubmit] = useTransition();

  if (isOwner) {
    // Not vaulted, not mid-sale, and not currently listed — e.g. a
    // Full-Service item straight out of grading, which is created with no
    // price at all. Rather than sending the owner off to hunt for this in
    // Portfolio, let them list it right here.
    if (!vaulted && marketStatus !== "IN_ESCROW" && !forSale) {
      return <OwnerListForSaleForm assetId={assetId} assetName={assetName} />;
    }
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
        {t("You own this item. Manage it from")}{" "}
        <a href="/portfolio" className="underline">
          {t("Portfolio")}
        </a>
        .
      </p>
    );
  }

  if (!forSale || priceThb == null) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
        {marketStatus === "IN_ESCROW"
          ? t("This item is on hold — another buyer is already purchasing it.")
          : t("This item is not currently for sale.")}
      </p>
    );
  }

  async function handleConfirm() {
    if (priceThb == null) return; // unreachable: this dialog only renders once priceThb is set
    setSigning(true);
    try {
      // Real on-chain escrow lock when both sides have a real wallet —
      // otherwise the simulated signed-message flow (see useEscrowLock).
      let escrowLock: EscrowLock | undefined;
      try {
        escrowLock = await lock(priceThb, sellerWalletAddress, `Confirm payment of ${priceThb} THB for this item`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("Could not lock in your payment. Try again."));
        return;
      }

      startSubmit(async () => {
        try {
          await buyListing(assetId, vaulted ? "VAULT" : fulfillment, escrowLock);
          toast.success(
            vaulted
              ? t("Purchased! Digital ownership transferred instantly.")
              : t("Payment held safely. Waiting for warehouse inspection."),
          );
          setOpen(false);
          router.refresh();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : t("Purchase failed."));
        }
      });
    } finally {
      setSigning(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {vaulted ? (
        <div className="flex items-start gap-3 rounded-lg border bg-indigo-500/5 p-4 text-sm">
          <Landmark className="mt-0.5 size-4 shrink-0 text-indigo-500" />
          <p>{t("Already in our vault — ownership transfers instantly, no shipping. Redeem it anytime.")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t("How do you want to receive it?")}</span>
          <Tabs value={fulfillment} onValueChange={(v) => setFulfillment(v as "SHIP" | "VAULT")}>
            <TabsList className="w-full">
              <TabsTrigger value="SHIP" className={ACTIVE_TAB_CLASS}>
                <Truck className="size-4" /> {t("Ship to My Address")}
              </TabsTrigger>
              <TabsTrigger value="VAULT" className={ACTIVE_TAB_CLASS}>
                <Landmark className="size-4" /> {t("Keep in Vault")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <p className="text-muted-foreground text-xs">
            {fulfillment === "SHIP"
              ? t("Ships to your address after inspection.")
              : t("Stored safely in the vault after inspection.")}
          </p>
        </div>
      )}

      <Button size="lg" onClick={() => setOpen(true)}>
        <ShieldCheck />
        {t("Buy — {price}", { price: formatThb(priceThb) })}
      </Button>

      <Dialog open={open} onOpenChange={(o) => !signing && !submitting && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Confirm Purchase")}</DialogTitle>
            <DialogDescription>{t("Payment stays protected until the item is verified.")}</DialogDescription>
          </DialogHeader>
          <div className="bg-muted/40 flex flex-col gap-2 rounded-lg border p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("Amount")}</span>
              <span className="font-semibold">{formatThb(priceThb)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("Delivery")}</span>
              <span>{t(vaulted ? "Instant Vault Transfer" : fulfillment === "SHIP" ? "Ship to Address" : "Deposit to Vault")}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={signing || submitting}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleConfirm} disabled={signing || submitting || connecting}>
              {signing || submitting ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
              {signing ? t("Waiting for approval…") : submitting ? t("Processing…") : t("Confirm & Pay")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OwnerListForSaleForm({ assetId, assetName }: { assetId: string; assetName: string }) {
  const router = useRouter();
  const { connected, connect, sendMemo } = useWalletStore();
  const [price, setPrice] = useState("");
  const [pending, startTransition] = useTransition();
  const t = useT();

  function handleList() {
    startTransition(async () => {
      try {
        let tx: string | undefined;
        try {
          if (!connected) await connect();
          tx = await sendMemo(`CardMart list: ${assetName} | ${Number(price)} THB`);
        } catch {
          tx = undefined;
        }
        await updateListingPrice(assetId, Number(price), tx);
        toast.success(t("Listed for sale."));
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("Could not list item."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Tag className="size-4" />
        {t("You own this item — set a price to list it")}
      </div>
      <p className="text-muted-foreground text-xs">
        {t("Grading is complete and your digital certificate has been created. It won't appear on the marketplace until you set a price.")}
      </p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="owner-list-price">{t("Price (THB)")}</Label>
        <Input
          id="owner-list-price"
          type="number"
          inputMode="numeric"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </div>
      <Button onClick={handleList} disabled={pending || !price || Number(price) <= 0}>
        {pending && <Loader2 className="animate-spin" />}
        {t("List for Sale")}
      </Button>
      <a href="/portfolio" className="text-muted-foreground text-center text-xs underline">
        {t("Or manage it from Portfolio")}
      </a>
    </div>
  );
}
