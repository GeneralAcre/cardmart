"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BellRing, Loader2, Trash2 } from "lucide-react";
import type { GradingCompany } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WantedCardButton } from "@/components/wanted/wanted-card-form";
import { deleteWantedCard } from "@/lib/actions";
import { formatDateTime, formatThb } from "@/lib/format";

interface WantedCard {
  id: string;
  query: string;
  gradingCompany: GradingCompany | null;
  minGrade: number | null;
  blackLabelOnly: boolean;
  maxPriceThb: number | null;
  trustedOnly: boolean;
  lastMatchedAt: Date | null;
}

export function WantedCardsPanel({ cards }: { cards: WantedCard[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground max-w-xl text-sm">
          Tell us what you&apos;re hunting for. When a matching card is listed, you get a notification with a link
          straight to it.
        </p>
        <WantedCardButton label="New alert" variant="default" />
      </div>

      {cards.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-20 text-center">
          <BellRing className="size-8" />
          <p className="text-sm">No card alerts yet.</p>
          <Link href="/marketplace" className="text-foreground text-sm underline">
            Browse the marketplace
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {cards.map((card) => (
            <WantedCardRow key={card.id} card={card} />
          ))}
        </div>
      )}
    </div>
  );
}

function WantedCardRow({ card }: { card: WantedCard }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const filters = [
    card.gradingCompany === "RAW" ? "Raw / ungraded" : card.gradingCompany,
    card.minGrade != null && `Grade ${card.minGrade}+`,
    card.blackLabelOnly && "Black Label",
    card.maxPriceThb != null && `Up to ${formatThb(card.maxPriceThb)}`,
    card.trustedOnly && "Trusted sellers",
  ].filter(Boolean) as string[];

  function remove() {
    startTransition(async () => {
      try {
        await deleteWantedCard(card.id);
        toast.success("Alert removed.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not remove alert.");
      }
    });
  }

  return (
    <div className="bg-card flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-sm font-semibold">&ldquo;{card.query}&rdquo;</span>
        <div className="flex flex-wrap gap-1.5">
          {filters.length === 0 ? (
            <Badge variant="outline">Any grade, any price</Badge>
          ) : (
            filters.map((f) => (
              <Badge key={f} variant="outline">
                {f}
              </Badge>
            ))
          )}
        </div>
        <span className="text-muted-foreground text-xs">
          {card.lastMatchedAt ? `Last match ${formatDateTime(card.lastMatchedAt)}` : "No matches yet"}
        </span>
      </div>
      <Button size="sm" variant="outline" onClick={remove} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
        Remove
      </Button>
    </div>
  );
}
