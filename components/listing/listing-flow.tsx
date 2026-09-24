"use client";

import { SelfMintForm } from "@/components/listing/self-mint-form";

export function ListingFlow({ escrowAuthorityAddress }: { escrowAuthorityAddress: string | null }) {
  return <SelfMintForm escrowAuthorityAddress={escrowAuthorityAddress} />;
}
