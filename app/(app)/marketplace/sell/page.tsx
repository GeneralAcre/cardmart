import { ChevronLeft } from "lucide-react";

import { ListingFlow } from "@/components/listing/listing-flow";
import { ActionButton } from "@/components/ui/action-button";
import { getEscrowAuthorityAddress } from "@/lib/web3/escrow-server";
import { getT } from "@/lib/i18n/server";

// Selling lives inside the Marketplace (the "Sell a card" button there), so
// the Marketplace tab stays highlighted here. /listing redirects to this page.
export default async function SellPage() {
  const [escrowAuthorityAddress, t] = await Promise.all([getEscrowAuthorityAddress(), getT()]);

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <div className="relative mb-8 flex flex-col gap-2">
        {/* From 1200px wide there's room in the margin left of the content
            column, so it sits there, level with the title; narrower screens
            (phones, small laptops) get it just above the title. */}
        <ActionButton
          href="/marketplace"
          icon={ChevronLeft}
          title={t("Back to Marketplace")}
          className="mb-2 w-fit min-[1200px]:absolute min-[1200px]:-top-1 min-[1200px]:right-full min-[1200px]:mr-6 min-[1200px]:mb-0"
        >
          {t("Back")}
        </ActionButton>
        <h1 className="text-2xl font-semibold">{t("Sell a card")}</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          {t("List a card you have now, or send a raw card in to be graded first.")}
        </p>
      </div>
      <ListingFlow escrowAuthorityAddress={escrowAuthorityAddress} />
    </div>
  );
}
