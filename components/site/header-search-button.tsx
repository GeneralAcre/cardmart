"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useT } from "@/components/landing/language-provider";

/** Fired on `window` to bring the Market banner back to its search slide and focus the field. */
export const OPEN_SEARCH_EVENT = "cardmart:open-search";

/**
 * A search icon in the phone header. The Market's only search box lives on the
 * first banner slide, which rotates away; this brings it back from anywhere.
 * On the Market page it asks the banner directly; elsewhere it opens the
 * Market with #search, which the banner picks up on load.
 */
export function HeaderSearchButton() {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();

  function open() {
    if (pathname === "/marketplace") {
      window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
    } else {
      router.push("/marketplace#search");
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="md:hidden"
      onClick={open}
      aria-label={t("Search cards")}
      title={t("Search cards")}
    >
      <Search className="size-4" />
    </Button>
  );
}
