"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cancelAuction } from "@/lib/actions";
import { useT } from "@/components/landing/language-provider";

export function CancelAuctionButton({ auctionId }: { auctionId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const t = useT();

  function handleCancel() {
    startTransition(async () => {
      try {
        await cancelAuction(auctionId);
        toast.success(t("Auction cancelled."));
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("Could not cancel auction."));
      }
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCancel} disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <X />}
      {t("Cancel Auction")}
    </Button>
  );
}
