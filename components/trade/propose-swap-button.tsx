"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import type { GradingCompany } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTradeSigning } from "@/components/trade/use-trade-signing";
import { proposeTrade } from "@/lib/actions";
import { formatGrade, formatThb } from "@/lib/format";

export interface SwappableCard {
  id: string;
  name: string;
  gradingCompany: GradingCompany;
  grade: number | null;
  isBlackLabel: boolean;
  priceThb: number | null;
  mintAddress: string | null;
}

function cardLabel(card: SwappableCard) {
  const grade = card.gradingCompany === "RAW" ? "Raw" : `${card.gradingCompany} ${formatGrade(card.grade)}`;
  return `${card.name} · ${grade}${card.isBlackLabel ? " BL" : ""}`;
}

type CashMode = "none" | "add" | "ask";

export function ProposeSwapButton({
  requestedAsset,
  recipientWalletAddress,
  myCards,
  escrowAuthorityAddress,
}: {
  requestedAsset: { id: string; name: string; priceThb: number | null };
  recipientWalletAddress: string | null;
  myCards: SwappableCard[];
  escrowAuthorityAddress: string | null;
}) {
  const router = useRouter();
  const { ensureConnected, approveCard, lockCash } = useTradeSigning();
  const [open, setOpen] = useState(false);
  const [offeredId, setOfferedId] = useState(myCards[0]?.id ?? "");
  const [cashMode, setCashMode] = useState<CashMode>("none");
  const [cash, setCash] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  const offered = myCards.find((c) => c.id === offeredId) ?? null;
  const cashAmount = cashMode === "none" ? 0 : Number(cash) || 0;
  const cashInvalid = cashMode !== "none" && (!Number.isInteger(cashAmount) || cashAmount < 100);

  async function submit() {
    if (!offered) return;
    setPending(true);
    try {
      await ensureConnected();
      const approveTxSignature = await approveCard(offered.mintAddress, escrowAuthorityAddress);
      let cashLock;
      if (cashMode === "add") {
        try {
          cashLock = await lockCash(cashAmount, recipientWalletAddress);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not lock your cash. Try again.");
          return;
        }
      }
      await proposeTrade({
        requestedAssetId: requestedAsset.id,
        offeredAssetId: offered.id,
        cashThb: cashMode === "add" ? cashAmount : cashMode === "ask" ? -cashAmount : 0,
        message: message.trim() || undefined,
        approveTxSignature,
        cashLock,
      });
      toast.success("Swap proposed — the owner has been notified.");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not propose swap.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <ArrowLeftRight /> Propose a Swap
      </Button>
      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Propose a Card Swap</DialogTitle>
            <DialogDescription>
              Offer one of your vaulted cards for {requestedAsset.name}, with cash on top either way if the values
              differ. Both cards stay in our vault, so the swap is instant once the owner accepts.
            </DialogDescription>
          </DialogHeader>

          {myCards.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
              You need a card in the CardMart vault to swap. Buy one with &ldquo;Keep in vault&rdquo;, or choose the
              vault when your next purchase ships.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label>Your card</Label>
                <Select value={offeredId} onValueChange={setOfferedId}>
                  <SelectTrigger className="w-full [&>span]:truncate">
                    <SelectValue placeholder="Choose a card" />
                  </SelectTrigger>
                  <SelectContent>
                    {myCards.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {cardLabel(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {offered?.priceThb != null && requestedAsset.priceThb != null && (
                  <p className="text-muted-foreground text-xs">
                    Your card is listed at {formatThb(offered.priceThb)}; theirs at {formatThb(requestedAsset.priceThb)}.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label>Cash difference</Label>
                <Tabs value={cashMode} onValueChange={(v) => setCashMode(v as CashMode)}>
                  <TabsList className="w-full">
                    <TabsTrigger value="none">Card only</TabsTrigger>
                    <TabsTrigger value="add">I add cash</TabsTrigger>
                    <TabsTrigger value="ask">I ask for cash</TabsTrigger>
                  </TabsList>
                </Tabs>
                {cashMode !== "none" && (
                  <>
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder="Amount in THB (min 100)"
                      value={cash}
                      onChange={(e) => setCash(e.target.value)}
                    />
                    <p className="text-muted-foreground text-xs">
                      {cashMode === "add"
                        ? "Your cash is locked in escrow now, and refunded automatically if the swap is declined or withdrawn."
                        : "The owner pays this into escrow when they accept."}
                    </p>
                  </>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="swap-message">Message (optional)</Label>
                <Textarea
                  id="swap-message"
                  rows={2}
                  placeholder="Why this is a fair swap…"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending || !offered || cashInvalid}>
              {pending ? <Loader2 className="animate-spin" /> : <ArrowLeftRight />}
              Send Proposal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
