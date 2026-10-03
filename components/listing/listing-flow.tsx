"use client";

import { SelfMintForm } from "@/components/listing/self-mint-form";

// Listing used to offer a second path, "Get it graded first" (the
// Full-Service grading package). That service is retired for users, so
// selling is just listing a card now. The back-office grading queue still
// exists so any submission already in progress can be finished.
export function ListingFlow({ escrowAuthorityAddress }: { escrowAuthorityAddress: string | null }) {
  return <SelfMintForm escrowAuthorityAddress={escrowAuthorityAddress} />;
}
