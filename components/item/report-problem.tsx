"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { openDispute } from "@/lib/actions";
import { DISPUTE_REASON_LABELS, DISPUTE_STATUS_LABELS } from "@/lib/shipping";
import { cn } from "@/lib/utils";
import { useT } from "@/components/landing/language-provider";

type Reason = keyof typeof DISPUTE_REASON_LABELS;

export interface ExistingDispute {
  reason: Reason;
  status: keyof typeof DISPUTE_STATUS_LABELS;
  resolutionNote: string | null;
}

/**
 * Lets the buyer of a completed purchase report a problem to staff (see
 * openDispute in lib/actions.ts). Once reported, shows where it stands
 * instead of the form.
 */
export function ReportProblem({ escrowTxId, dispute }: { escrowTxId: string; dispute: ExistingDispute | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason | null>(null);
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();
  const t = useT();

  if (dispute) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold">{t("Problem reported")}</span>
          <Badge variant={dispute.status === "OPEN" ? "default" : "secondary"}>
            {dispute.status === "OPEN" ? t("Under review") : t(DISPUTE_STATUS_LABELS[dispute.status])}
          </Badge>
        </div>
        <span className="text-muted-foreground text-xs">{t(DISPUTE_REASON_LABELS[dispute.reason])}</span>
        {dispute.resolutionNote && <p className="bg-muted/40 rounded-lg p-3 text-sm">{dispute.resolutionNote}</p>}
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 text-xs underline-offset-2 hover:underline"
      >
        <AlertTriangle className="size-3.5" />
        {t("Something wrong with this purchase? Report a problem")}
      </button>
    );
  }

  function submit() {
    if (!reason) return;
    startTransition(async () => {
      const res = await openDispute(escrowTxId, reason, description);
      if (res.error) {
        toast.error(t(res.error));
        return;
      }
      toast.success(t("Reported. Our team will look into it and reply here."));
      router.refresh();
    });
  }

  return (
    <div className="bg-card flex flex-col gap-3 rounded-xl border p-4">
      <span className="text-sm font-semibold">{t("Report a problem")}</span>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(DISPUTE_REASON_LABELS) as Reason[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setReason(r)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              reason === r ? "border-foreground bg-foreground text-background" : "hover:border-foreground/50",
            )}
          >
            {t(DISPUTE_REASON_LABELS[r])}
          </button>
        ))}
      </div>
      <Textarea
        rows={3}
        placeholder={t("What happened? Include anything that helps us check, like damage or a missing package.")}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={!reason || description.trim().length < 20 || pending} onClick={submit}>
          {pending && <Loader2 className="animate-spin" />}
          {t("Send report")}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          {t("Cancel")}
        </Button>
      </div>
    </div>
  );
}
