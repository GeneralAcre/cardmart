"use client";

import { useState } from "react";
import type { VerificationPackage } from "@prisma/client";

import { PackageSelector } from "@/components/verify/package-selector";
import { SelfMintForm } from "@/components/verify/self-mint-form";
import { FullServiceForm } from "@/components/verify/full-service-form";

export function VerifyFlow({ escrowAuthorityAddress }: { escrowAuthorityAddress: string | null }) {
  const [pkg, setPkg] = useState<VerificationPackage>("SELF_MINT");

  return (
    <div className="flex flex-col gap-8">
      <PackageSelector value={pkg} onChange={setPkg} />
      {pkg === "SELF_MINT" ? (
        <SelfMintForm escrowAuthorityAddress={escrowAuthorityAddress} />
      ) : (
        <FullServiceForm />
      )}
    </div>
  );
}
