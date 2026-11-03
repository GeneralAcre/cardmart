import { ListingFlow } from "@/components/listing/listing-flow";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageTour } from "@/components/tour/page-tour";
import { getEscrowAuthorityAddress } from "@/lib/web3/escrow-server";
import { getT } from "@/lib/i18n/server";

// Selling lives inside the Marketplace (the "Sell a card" button there), so
// the Marketplace tab stays highlighted here. /listing redirects to this page.
export default async function SellPage() {
  const [escrowAuthorityAddress, t] = await Promise.all([getEscrowAuthorityAddress(), getT()]);

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      {/* The way back up to the Market, like every other page under it. */}
      <Breadcrumbs items={[{ label: t("Market"), href: "/marketplace" }, { label: t("Sell a card") }]} />
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t("Sell a card")}</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          {t("List a graded or ungraded card you have in hand. It goes live on the market once you confirm.")}
        </p>
      </div>
      <PageTour id="sell" />
      <ListingFlow escrowAuthorityAddress={escrowAuthorityAddress} />
    </div>
  );
}
