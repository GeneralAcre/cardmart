import { ListingFlow } from "@/components/listing/listing-flow";
import { getEscrowAuthorityAddress } from "@/lib/web3/escrow-server";

export default async function ListingPage() {
  const escrowAuthorityAddress = await getEscrowAuthorityAddress();

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Create a Listing</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          Add your item details, choose whether it&apos;s graded or ungraded,
          set your listing price, and publish it on the marketplace.
        </p>
      </div>
      <ListingFlow escrowAuthorityAddress={escrowAuthorityAddress} />
    </div>
  );
}
