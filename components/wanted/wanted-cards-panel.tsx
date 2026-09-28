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
import { useT } from "@/components/landing/language-provider";

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
  const t = useT();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground max-w-xl text-sm">
          {t("Tell us what you're hunting for. When a matching card is listed, you get a notification with a link straight to it.")}
        </p>
        <WantedCardButton label={t("New alert")} variant="default" />
      </div>

      {cards.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-20 text-center">
          <BellRing className="size-8" />
          <p className="text-sm">{t("No card alerts yet.")}</p>
          <Link href="/marketplace" className="text-foreground text-sm underline">
            {t("Browse the marketplace")}
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
  const t = useT();

  const filters = [
    card.gradingCompany === "RAW" ? t("Raw / Ungraded") : card.gradingCompany,
    card.minGrade != null && t("Grade {grade}+", { grade: card.minGrade }),
    card.blackLabelOnly && "Black Label",
    card.maxPriceThb != null && t("Up to {price}", { price: formatThb(card.maxPriceThb) }),
    card.trustedOnly && t("Trusted sellers"),
  ].filter(Boolean) as string[];

  function remove() {
    startTransition(async () => {
      try {
        await deleteWantedCard(card.id);
        toast.success(t("Alert removed."));
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("Could not remove alert."));
      }
    });
  }

  return (
    <div className="bg-card flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-sm font-semibold">&ldquo;{card.query}&rdquo;</span>
        <div className="flex flex-wrap gap-1.5">
          {filters.length === 0 ? (
            <Badge variant="outline">{t("Any grade, any price")}</Badge>
          ) : (
            filters.map((f) => (
              <Badge key={f} variant="outline">
                {f}
              </Badge>
            ))
          )}
        </div>
        <span className="text-muted-foreground text-xs">
          {card.lastMatchedAt ? t("Last match {date}", { date: formatDateTime(card.lastMatchedAt) }) : t("No matches yet")}
        </span>
      </div>
      <Button size="sm" variant="outline" onClick={remove} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
        {t("Remove")}
      </Button>
    </div>
  );
}
