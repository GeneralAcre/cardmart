import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { ListingFlow } from "@/components/listing/listing-flow";
import { Button } from "@/components/ui/button";
import { getEscrowAuthorityAddress } from "@/lib/web3/escrow-server";
import { getT } from "@/lib/i18n/server";

// Selling lives inside the Marketplace (the "Sell a card" button there), so
// the Marketplace tab stays highlighted here. /listing redirects to this page.
export default async function SellPage() {
  const [escrowAuthorityAddress, t] = await Promise.all([getEscrowAuthorityAddress(), getT()]);

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="icon" className="shrink-0">
            <Link href="/marketplace" aria-label={t("Back to Marketplace")} title={t("Back to Marketplace")}>
              <ChevronLeft />
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">{t("Sell a card")}</h1>
        </div>
        <p className="text-muted-foreground max-w-2xl text-sm">
          {t("List a card you have now, or send a raw card in to be graded first.")}
        </p>
      </div>
      <ListingFlow escrowAuthorityAddress={escrowAuthorityAddress} />
    </div>
  );
}
