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
import { buyListing, getMyWalletBalanceSol, updateListingPrice } from "@/lib/actions";
import { THB_PER_SOL, buyerFeeThb } from "@/lib/pricing";
import { useWalletStore } from "@/lib/web3/wallet-store";
import { useEscrowLock, type EscrowLock } from "@/lib/web3/use-escrow-lock";
import { PriceRows } from "@/components/item/complete-purchase-button";
import { cn } from "@/lib/utils";
import { ITEM_ACTION_BOX_CLASS, ITEM_ACTION_BUTTON_CLASS, ITEM_ACTION_SLOT_CLASS } from "@/lib/item-actions";
import { useT } from "@/components/landing/language-provider";
import { useCurrency } from "@/components/currency-provider";

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
  /** The platform wallet the buyer-protection fee is paid to. */
  platformWalletAddress: string | null;
  /** The card's NFT exists but its owner hasn't approved the transfer yet, so it can't be bought. */
  awaitingSellerApproval?: boolean;
  /** The listing and market prices, shown in the box above the delivery choice and Buy button. */
  priceSummary: React.ReactNode;
}

/** The price box, with Buy inside when there is one. Also used on its own when there's nothing to buy (auction, redeemed). */
export function PricePanel({ summary, action }: { summary: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className={ITEM_ACTION_BOX_CLASS}>
      <div className="min-w-0 flex-1">{summary}</div>
      {action && <div className={ITEM_ACTION_SLOT_CLASS}>{action}</div>}
    </div>
  );
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
  platformWalletAddress,
  awaitingSellerApproval = false,
  priceSummary,
}: BuyPanelProps) {
  const router = useRouter();
  const { lock, connecting } = useEscrowLock();
  const t = useT();

  const [fulfillment, setFulfillment] = useState<"SHIP" | "VAULT">("SHIP");
  const [open, setOpen] = useState(false);
  const [signing, setSigning] = useState(false);
  const [submitting, startSubmit] = useTransition();
  // The buyer's SOL balance, loaded when the dialog opens: undefined while
  // loading, null when unknown (no wallet, or the network call failed).
  const [balanceSol, setBalanceSol] = useState<number | null | undefined>(undefined);

  function openCheckout() {
    setOpen(true);
    setBalanceSol(undefined);
    getMyWalletBalanceSol().then(setBalanceSol, () => setBalanceSol(null));
  }

  if (isOwner) {
    // Not vaulted, not mid-sale, and not currently listed — e.g. a
    // Full-Service item straight out of grading, which is created with no
    // price at all. Rather than sending the owner off to hunt for this in
    // Portfolio, let them list it right here.
    if (!vaulted && marketStatus !== "IN_ESCROW" && !forSale) {
      return (
        <>
          <PricePanel summary={priceSummary} />
          <OwnerListForSaleForm assetId={assetId} assetName={assetName} />
        </>
      );
    }
    return <PricePanel summary={priceSummary} />;
  }

  if (forSale && awaitingSellerApproval) {
    return (
      <>
        <PricePanel summary={priceSummary} />
        <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
          {t("Almost ready: the seller still needs to approve this card's NFT transfer before it can be bought.")}
        </p>
      </>
    );
  }

  if (!forSale || priceThb == null) {
    return (
      <>
        <PricePanel summary={priceSummary} />
        <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
          {marketStatus === "IN_ESCROW"
            ? t("This item is on hold — another buyer is already purchasing it.")
            : t("This item is not currently for sale.")}
        </p>
      </>
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
        escrowLock = await lock(priceThb, sellerWalletAddress, `Confirm payment of ${priceThb} THB for this item`, platformWalletAddress);
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
      {/* Prices on the left, Buy inside the same box on the right. The price is
          right beside it, so the button only says Buy. */}
      <PricePanel
        summary={priceSummary}
        action={
          <Button
            size="lg"
            onClick={openCheckout}
            className={cn("bg-foreground text-background hover:bg-foreground/85", ITEM_ACTION_BUTTON_CLASS)}
          >
            {t("Buy now")}
          </Button>
        }
      />

      <Dialog open={open} onOpenChange={(o) => !signing && !submitting && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Confirm Purchase")}</DialogTitle>
            <DialogDescription>{t("Payment stays protected until the item is verified.")}</DialogDescription>
          </DialogHeader>
          {/* The delivery choice lives here, at the moment of paying, not on the page.
              A vaulted card has nothing to choose: ownership just transfers. */}
          {!vaulted && (
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
          <div className="bg-muted/40 flex flex-col gap-2 rounded-lg border p-3 text-sm">
            <PriceRows priceThb={priceThb} withFee />
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("Delivery")}</span>
              <span>{t(vaulted ? "Instant Vault Transfer" : fulfillment === "SHIP" ? "Ship to Address" : "Deposit to Vault")}</span>
            </div>
            {/* The wallet balance shows here, where it matters, rather than on the portfolio. */}
            <WalletBalanceRow balanceSol={balanceSol} totalThb={priceThb + buyerFeeThb(priceThb)} />
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

/**
 * The buyer's SOL balance in the Confirm Purchase dialog, with a heads-up when
 * it's short of the total. Only a heads-up: demo wallets pay through the
 * simulated escrow, so it never blocks the purchase.
 */
function WalletBalanceRow({ balanceSol, totalThb }: { balanceSol: number | null | undefined; totalThb: number }) {
  const t = useT();
  const { currency, money } = useCurrency();
  if (balanceSol === null) return null;
  const neededSol = totalThb / THB_PER_SOL;
  const short = balanceSol !== undefined && balanceSol < neededSol;
  return (
    <>
      <div className="flex justify-between border-t pt-2">
        <span className="text-muted-foreground">{t("Your wallet balance")}</span>
        {/* In the chosen currency, at the escrow rate; the exact SOL is on hover. */}
        <span
          className={cn("tabular-nums", short && "text-destructive font-medium")}
          title={balanceSol === undefined ? undefined : `${balanceSol.toFixed(4)} SOL`}
        >
          {balanceSol === undefined ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : currency === "SOL" ? (
            `${balanceSol.toFixed(4)} SOL`
          ) : (
            money(balanceSol * THB_PER_SOL)
          )}
        </span>
      </div>
      {short && (
        <p className="text-destructive text-xs">{t("Not enough SOL for this purchase. Deposit more from your Portfolio first.")}</p>
      )}
    </>
  );
}
