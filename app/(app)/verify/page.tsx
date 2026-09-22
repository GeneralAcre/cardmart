import { VerifyFlow } from "@/components/verify/verify-flow";
import { getEscrowAuthorityAddress } from "@/lib/web3/escrow-server";

export default async function VerifyPage() {
  const escrowAuthorityAddress = await getEscrowAuthorityAddress();

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">List an Item</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          Two ways to get started — pick whichever matches what you&apos;re
          holding right now. You can always add more items later.
        </p>
      </div>
      <VerifyFlow escrowAuthorityAddress={escrowAuthorityAddress} />
    </div>
  );
}
