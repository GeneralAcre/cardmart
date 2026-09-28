"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RatingInput } from "@/components/store/rating-input";
import { submitReview } from "@/lib/actions";
import { useT } from "@/components/landing/language-provider";

export function LeaveReviewForm({ escrowTxId }: { escrowTxId: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [pending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const t = useT();

  function handleSubmit() {
    startTransition(async () => {
      const res = await submitReview(escrowTxId, rating, comment);
      if (res.error) {
        toast.error(t(res.error));
        return;
      }
      toast.success(t("Review submitted — thanks!"));
      setSubmitted(true);
      router.refresh();
    });
  }

  if (submitted) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 rounded-xl border border-dashed p-4 text-sm">
        <CheckCircle2 className="size-4" />
        {t("Thanks for rating this seller.")}
      </div>
    );
  }

  return (
    <div className="bg-card flex flex-col gap-3 rounded-xl border p-4">
      <span className="text-sm font-semibold">{t("Rate this seller")}</span>
      <RatingInput value={rating} onChange={setRating} />
      <Textarea
        placeholder={t("Optional — how was the transaction?")}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
      />
      <div className="flex items-center gap-2">
        <Button size="sm" className="w-fit" disabled={rating === 0 || pending} onClick={handleSubmit}>
          {pending && <Loader2 className="animate-spin" />}
          {t("Submit Review")}
        </Button>
        {rating === 0 && <span className="text-muted-foreground text-xs">{t("Select a rating first")}</span>}
      </div>
    </div>
  );
}
