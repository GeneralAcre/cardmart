"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";

import { useLanguage } from "@/components/landing/language-provider";

/** A small share icon for the card name. Copies the card's link. */
export function ItemShareButton({ path }: { path: string }) {
  const { tr: t } = useLanguage();

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).href);
      toast.success(t("Link copied"));
    } catch {
      toast.error(t("Could not share."));
    }
  }

  return (
    <button
      type="button"
      onClick={copyLink}
      aria-label={t("Copy link")}
      title={t("Copy link")}
      className="text-muted-foreground hover:text-foreground inline-flex size-8 shrink-0 items-center justify-center rounded-full transition-colors"
    >
      <Share2 className="size-5" />
    </button>
  );
}
