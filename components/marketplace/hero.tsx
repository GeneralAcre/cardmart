import Link from "next/link";
import { ShieldCheck, Vault, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <div className="relative overflow-hidden border-b bg-[radial-gradient(120%_140%_at_10%_-10%,rgba(99,102,241,0.18),transparent_60%)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-16 sm:px-6 sm:py-24">
        <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl">
          Provenance Trading: trade real collectibles secured by physical escrow
          &amp; digital certificates.
        </h1>
        <p className="text-muted-foreground max-w-xl text-base sm:text-lg">
          List PSA, BGS, and CGC certified trading cards. Every sale is
          protected by escrow, verified at our warehouse, and mirrored by an
          on-chain digital twin.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button size="lg" asChild>
            <Link href="/marketplace">Browse Marketplace</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/verify">Get Verified</Link>
          </Button>
        </div>
        <div className="text-muted-foreground grid grid-cols-1 gap-4 pt-8 sm:grid-cols-3">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-emerald-500 size-5 shrink-0" />
            <span className="text-sm">Web2 escrow locks payment until inspection passes.</span>
          </div>
          <div className="flex items-center gap-3">
            <Vault className="text-indigo-500 size-5 shrink-0" />
            <span className="text-sm">Vault trading: instant transfer, zero shipping fees.</span>
          </div>
          <div className="flex items-center gap-3">
            <Truck className="text-amber-500 size-5 shrink-0" />
            <span className="text-sm">Redeem the physical item from the vault anytime.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
