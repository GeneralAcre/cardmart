"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cancelAuction } from "@/lib/actions";

export function CancelAuctionButton({ auctionId }: { auctionId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleCancel() {
    startTransition(async () => {
      try {
        await cancelAuction(auctionId);
        toast.success("Auction cancelled.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not cancel auction.");
      }
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCancel} disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <X />}
      Cancel Auction
    </Button>
  );
}
