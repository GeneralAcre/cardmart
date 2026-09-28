"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { settleAuction } from "@/lib/actions";

/**
 * Auctions have no cron job: whenever someone opens a page showing an
 * auction whose bidding has closed, this asks the server to settle whatever
 * is due (refund outbid locks, complete the sale, lapse an unclaimed legacy
 * win). settleAuction is idempotent, so several viewers at once is fine.
 * Renders nothing.
 */
export function AutoSettle({ auctionIds }: { auctionIds: string[] }) {
  const router = useRouter();
  const key = auctionIds.join(",");

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    Promise.all(key.split(",").map((id) => settleAuction(id).catch(() => ({ settled: false }))))
      .then((results) => {
        if (!cancelled && results.some((r) => r.settled)) router.refresh();
      });
    return () => {
      cancelled = true;
    };
  }, [key, router]);

  return null;
}
