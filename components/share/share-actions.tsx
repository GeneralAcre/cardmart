"use client";

import { useState } from "react";
import { Check, Download, Link2, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/landing/language-provider";

/**
 * Download, share and copy-link buttons for a sale receipt image. On phones
 * the native share sheet sends the image itself (LINE, Instagram, …); on
 * desktop it falls back to posting the link on X, whose preview is the image.
 */
export function ShareActions({ imageUrl, pageUrl, text, fileName }: { imageUrl: string; pageUrl: string; text: string; fileName: string }) {
  const { tr: t } = useLanguage();
  const [copied, setCopied] = useState(false);
  // pageUrl is a path; links that leave the site need the full address.
  const fullUrl = () => new URL(pageUrl, window.location.origin).href;

  async function nativeShare() {
    try {
      const blob = await (await fetch(imageUrl)).blob();
      const file = new File([blob], `${fileName}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text, url: fullUrl() });
        return;
      }
      if (navigator.share) {
        await navigator.share({ text, url: fullUrl() });
        return;
      }
      window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(fullUrl())}`, "_blank");
    } catch (err) {
      // The user closing the share sheet isn't an error worth showing.
      if (err instanceof Error && err.name === "AbortError") return;
      toast.error(t("Could not share."));
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(fullUrl());
    setCopied(true);
    toast.success(t("Link copied"));
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={nativeShare}>
        <Share2 /> {t("Share")}
      </Button>
      <Button asChild variant="outline">
        <a href={imageUrl} download={`${fileName}.png`}>
          <Download /> {t("Download image")}
        </a>
      </Button>
      <Button variant="outline" onClick={copyLink}>
        {copied ? <Check /> : <Link2 />} {t("Copy link")}
      </Button>
    </div>
  );
}
