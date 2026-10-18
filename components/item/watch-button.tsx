"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toggleWatchlist } from "@/lib/actions";
import { useT } from "@/components/landing/language-provider";

export function WatchButton({ assetId, initialWatching, className, iconOnly = false }: { assetId: string; initialWatching: boolean; className?: string; iconOnly?: boolean }) {
  const [watching, setWatching] = useState(initialWatching);
  const [pending, startTransition] = useTransition();
  const t = useT();
  const buttonLabel = watching ? t("Watching") : t("Watch");

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
    <Button
      size={iconOnly ? "icon" : "sm"}
      variant={watching ? "secondary" : "outline"}
      onClick={handleClick}
      disabled={pending}
      className={className}
      aria-label={buttonLabel}
      title={buttonLabel}
    >
      {pending ? (
        <Loader2 className="animate-spin" />
      ) : watching ? (
        <BookmarkCheck className="fill-current" />
      ) : (
        <Bookmark />
      )}
      {!iconOnly && buttonLabel}
    </Button>
  );
}
