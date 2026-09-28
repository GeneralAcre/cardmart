import { ListingFlow } from "@/components/listing/listing-flow";
import { getEscrowAuthorityAddress } from "@/lib/web3/escrow-server";
import { getT } from "@/lib/i18n/server";

export default async function ListingPage() {
  const [escrowAuthorityAddress, t] = await Promise.all([getEscrowAuthorityAddress(), getT()]);

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t("Create a Listing")}</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          {t("List a card you have now, or send a raw card in to be graded first.")}
        </p>
      </div>
      <ListingFlow escrowAuthorityAddress={escrowAuthorityAddress} />
    </div>
  );
}
