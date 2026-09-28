"use client";

import { useState } from "react";
import { BadgeCheck, Sparkles } from "lucide-react";

import { FullServiceForm } from "@/components/listing/full-service-form";
import { SelfMintForm } from "@/components/listing/self-mint-form";
import { FULL_SERVICE_PACKAGE_PRICE_THB, SELF_MINT_FEE_THB } from "@/lib/pricing";
import { formatThb } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useT } from "@/components/landing/language-provider";

type Path = "list" | "grade";

const PATHS: { key: Path; icon: typeof BadgeCheck; title: string; body: string; price: number }[] = [
  {
    key: "list",
    icon: BadgeCheck,
    title: "List a card now",
    body: "Already slabbed, or selling it raw. Verify it with photos and list it — {price} fee.",
    price: SELF_MINT_FEE_THB,
  },
  {
    key: "grade",
    icon: Sparkles,
    title: "Get it graded first",
    body: "Send a raw card in. We ship it to PSA, BGS or CGC and mint it once it's graded — {price} all-in.",
    price: FULL_SERVICE_PACKAGE_PRICE_THB,
  },
];

export function ListingFlow({ escrowAuthorityAddress }: { escrowAuthorityAddress: string | null }) {
  const [path, setPath] = useState<Path>("list");
  const t = useT();

  return (
    <div className="flex flex-col gap-6">
      <div role="radiogroup" aria-label={t("How do you want to add your card?")} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PATHS.map(({ key, icon: Icon, title, body, price }) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={path === key}
            onClick={() => setPath(key)}
            className={cn(
              "flex items-start gap-3 rounded-xl border p-4 text-left transition-colors",
              path === key ? "border-foreground bg-accent/40" : "hover:bg-accent/30",
            )}
          >
            <Icon className="mt-0.5 size-5 shrink-0" />
            <span className="flex flex-col gap-1">
              <span className="text-sm font-semibold">{t(title)}</span>
              <span className="text-muted-foreground text-xs">{t(body, { price: formatThb(price) })}</span>
            </span>
          </button>
        ))}
      </div>
      {path === "list" ? <SelfMintForm escrowAuthorityAddress={escrowAuthorityAddress} /> : <FullServiceForm />}
    </div>
  );
}
