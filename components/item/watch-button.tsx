"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toggleWatchlist } from "@/lib/actions";
import { useT } from "@/components/landing/language-provider";

export function WatchButton({ assetId, initialWatching }: { assetId: string; initialWatching: boolean }) {
  const [watching, setWatching] = useState(initialWatching);
  const [pending, startTransition] = useTransition();
  const t = useT();

  function handleClick() {
    startTransition(async () => {
      try {
        const res = await toggleWatchlist(assetId);
        setWatching(res.watching);
        toast.success(res.watching ? t("Added to watchlist") : t("Removed from watchlist"));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("Could not update watchlist."));
      }
    });
  }

  return (
    <Button size="sm" variant={watching ? "secondary" : "outline"} onClick={handleClick} disabled={pending}>
      {pending ? (
        <Loader2 className="animate-spin" />
      ) : watching ? (
        <BookmarkCheck className="fill-current" />
      ) : (
        <Bookmark />
      )}
      {watching ? t("Watching") : t("Watch")}
    </Button>
  );
}
