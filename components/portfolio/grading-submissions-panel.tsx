import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { GradingSubmissionStatus } from "@prisma/client";

import type { getMyGradingSubmissions } from "@/lib/queries";
import { CARD_GAME_LABELS, GRADING_SUBMISSION_STATUS_LABELS } from "@/lib/labels";
import { formatDate, formatGrade, formatThb } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

const STEPS: GradingSubmissionStatus[] = ["AWAITING_SHIPMENT_TO_GRADER", "AT_GRADING_COMPANY", "GRADED"];

export async function GradingSubmissionsPanel({
  submissions,
}: {
  submissions: Awaited<ReturnType<typeof getMyGradingSubmissions>>;
}) {
  const t = await getT();
  if (submissions.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-20 text-center">
        <Sparkles className="size-8" />
        <p className="text-sm">{t("No cards sent for grading yet.")}</p>
        <Link href="/listing" className="text-foreground text-sm font-medium underline">
          {t("Send a raw card for grading")}
        </Link>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {submissions.map((s) => {
        const step = STEPS.indexOf(s.status);
        return (
          <li key={s.id} className="flex flex-col gap-3 rounded-xl border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-semibold">{s.itemName}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {t(CARD_GAME_LABELS[s.game])} · {s.gradingCompany} · {s.itemSubtitle}
                </span>
              </div>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium",
                  s.status === "REJECTED"
                    ? "bg-destructive/10 text-destructive"
                    : s.status === "GRADED"
                      ? "bg-success/10 text-success"
                      : "bg-muted",
                )}
              >
                {t(GRADING_SUBMISSION_STATUS_LABELS[s.status])}
              </span>
            </div>
            {s.status !== "REJECTED" && (
              <ol className="grid grid-cols-3 gap-1.5" aria-label={t("Progress")}>
                {STEPS.map((st, i) => (
                  <li key={st} className="flex flex-col gap-1">
                    <span className={cn("h-1 rounded-full", i <= step ? "bg-foreground" : "bg-muted")} />
                    <span className={cn("text-[11px]", i <= step ? "text-foreground" : "text-muted-foreground")}>
                      {t(GRADING_SUBMISSION_STATUS_LABELS[st])}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-xs">
              <span>
                {t("Sent {date} · paid {price}", { date: formatDate(s.createdAt), price: formatThb(s.packagePriceThb) })}
                {s.resolvedAt && ` · ${t("resolved {date}", { date: formatDate(s.resolvedAt) })}`}
              </span>
              {s.resultAsset && (
                <Link href={`/item/${s.resultAsset.id}`} className="text-foreground font-medium underline">
                  {t("Graded {grade} — set a price", {
                    grade: `${s.gradingCompany} ${formatGrade(s.resultAsset.grade)}${s.resultAsset.isBlackLabel ? " Black Label" : ""}`,
                  })}
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
