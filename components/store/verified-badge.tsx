import { BadgeCheck } from "lucide-react";
import type { KycStatus } from "@prisma/client";

import { cn } from "@/lib/utils";

/** Shown next to a seller's name once staff have verified their identity (KYC). Renders nothing otherwise. */
export function VerifiedBadge({ status, className }: { status: KycStatus | null | undefined; className?: string }) {
  if (status !== "VERIFIED") return null;
  return (
    <span
      className={cn(
        "text-success inline-flex shrink-0 items-center gap-1 text-xs font-medium",
        className,
      )}
      title="Identity verified by CardMart staff"
    >
      <BadgeCheck className="size-3.5" />
      ID verified
    </span>
  );
}
