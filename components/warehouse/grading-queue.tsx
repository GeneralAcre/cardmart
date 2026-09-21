"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, PackageCheck, Sparkles, XOctagon } from "lucide-react";
import type { GradingSubmission, User } from "@prisma/client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  adminCompleteGrading,
  adminMarkAtGradingCompany,
  adminRejectGradingSubmission,
  bulkMarkAtGradingCompany,
  type BulkActionResult,
} from "@/lib/actions";
import { useWalletStore } from "@/lib/web3/wallet-store";
import { CATEGORY_LABELS, GRADING_COMPANY_LABELS, GRADING_SUBMISSION_STATUS_LABELS } from "@/lib/labels";
import { formatDate } from "@/lib/format";

type SubmissionWithSeller = GradingSubmission & { seller: User };

function reportBulkResult(result: BulkActionResult, verb: string) {
  if (result.succeeded.length > 0) {
    toast.success(`${verb} ${result.succeeded.length} item${result.succeeded.length === 1 ? "" : "s"}.`);
  }
  if (result.skipped.length > 0) {
    toast.error(
      `Skipped ${result.skipped.length}: ${result.skipped
        .slice(0, 3)
        .map((s) => `${s.itemName} (${s.reason})`)
        .join("; ")}${result.skipped.length > 3 ? "…" : ""}`,
    );
  }
}

export function GradingQueue({ submissions }: { submissions: SubmissionWithSeller[] }) {
  const router = useRouter();
  const { connected, connect, sendMemo } = useWalletStore();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [gradeTarget, setGradeTarget] = useState<SubmissionWithSeller | null>(null);
  const [rejectTarget, setRejectTarget] = useState<SubmissionWithSeller | null>(null);
  const [grade, setGrade] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPending, startBulkTransition] = useTransition();

  // Only shipment confirmation is a real bulk candidate — completing a
  // grade needs one number typed per item, and rejecting needs individual
  // judgment, so only AWAITING_SHIPMENT_TO_GRADER rows are selectable.
  const shippable = submissions.filter((s) => s.status === "AWAITING_SHIPMENT_TO_GRADER");
  const allShippableSelected = shippable.length > 0 && shippable.every((s) => selected.has(s.id));

  function toggleAllShippable() {
    setSelected(allShippableSelected ? new Set() : new Set(shippable.map((s) => s.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function bulkMarkShipped() {
    const ids = Array.from(selected);
    startBulkTransition(async () => {
      try {
        const result = await bulkMarkAtGradingCompany(ids);
        reportBulkResult(result, "Marked shipped for");
        setSelected(new Set());
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Bulk action failed.");
      }
    });
  }

  function markShipped(id: string) {
    setBusyId(id);
    startTransition(async () => {
      try {
        await adminMarkAtGradingCompany(id);
        toast.success("Marked as shipped to the grading company.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Action failed.");
      } finally {
        setBusyId(null);
      }
    });
  }

  function completeGrading() {
    if (!gradeTarget) return;
    setBusyId(gradeTarget.id);
    startTransition(async () => {
      try {
        // Real on-chain transaction (a Memo instruction), signed by the
        // staff member completing the grading — same mechanism Self-Mint
        // uses, so this is a genuine devnet transaction, not a simulated one.
        let mintTxSignature: string | undefined;
        try {
          if (!connected) await connect();
          mintTxSignature = await sendMemo(
            `Proof grading complete: ${gradeTarget.itemName} | ${gradeTarget.gradingCompany} ${grade}`,
          );
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not sign the on-chain record.");
          return;
        }

        const fd = new FormData();
        fd.set("grade", grade);
        if (mintTxSignature) fd.set("mintTxSignature", mintTxSignature);

        const res = await adminCompleteGrading(gradeTarget.id, {}, fd);
        if (res.error) {
          toast.error(res.error);
          return;
        }
        toast.success("Graded and minted on-chain. The seller can now price and list it.");
        setGradeTarget(null);
        setGrade("");
        router.refresh();
      } finally {
        setBusyId(null);
      }
    });
  }

  function reject() {
    if (!rejectTarget) return;
    setBusyId(rejectTarget.id);
    startTransition(async () => {
      try {
        await adminRejectGradingSubmission(rejectTarget.id);
        toast.success("Submission rejected.");
        setRejectTarget(null);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Action failed.");
      } finally {
        setBusyId(null);
      }
    });
  }

  if (submissions.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-24 text-center">
        <Sparkles className="size-8" />
        <p className="text-sm">No Full-Service submissions in progress.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {selected.size > 0 && (
        <div className="bg-card flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button size="sm" onClick={bulkMarkShipped} disabled={bulkPending}>
            {bulkPending ? <Loader2 className="animate-spin" /> : <PackageCheck />}
            Mark Shipped Selected
          </Button>
        </div>
      )}

      <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              {shippable.length > 0 && (
                <Checkbox checked={allShippableSelected} onCheckedChange={toggleAllShippable} aria-label="Select all shippable" />
              )}
            </TableHead>
            <TableHead>Item</TableHead>
            <TableHead>Seller</TableHead>
            <TableHead>Grading Co.</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map((s) => (
            <TableRow key={s.id} data-state={selected.has(s.id) ? "selected" : undefined}>
              <TableCell>
                {s.status === "AWAITING_SHIPMENT_TO_GRADER" && (
                  <Checkbox
                    checked={selected.has(s.id)}
                    onCheckedChange={() => toggleOne(s.id)}
                    aria-label={`Select ${s.itemName}`}
                  />
                )}
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{s.itemName}</span>
                  <span className="text-muted-foreground text-xs">{CATEGORY_LABELS[s.category]}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span>{s.seller.name}</span>
                  {s.status === "AWAITING_SHIPMENT_TO_GRADER" && (
                    <span className="text-muted-foreground max-w-48 truncate text-xs" title={s.seller.shippingAddress ?? undefined}>
                      {s.seller.shippingAddress ?? "No pickup address on file"}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell>{GRADING_COMPANY_LABELS[s.gradingCompany]}</TableCell>
              <TableCell className="text-muted-foreground text-xs">{formatDate(s.createdAt)}</TableCell>
              <TableCell>
                <Badge variant="secondary">{GRADING_SUBMISSION_STATUS_LABELS[s.status]}</Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap justify-end gap-2">
                  {s.status === "AWAITING_SHIPMENT_TO_GRADER" && (
                    <Button size="sm" variant="outline" disabled={pending && busyId === s.id} onClick={() => markShipped(s.id)}>
                      {pending && busyId === s.id ? <Loader2 className="animate-spin" /> : null}
                      Mark Shipped
                    </Button>
                  )}
                  {s.status === "AT_GRADING_COMPANY" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setRejectTarget(s)}>
                        <XOctagon /> Reject
                      </Button>
                      <Button size="sm" onClick={() => setGradeTarget(s)}>
                        <PackageCheck /> Complete
                      </Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>

      <Dialog open={!!gradeTarget} onOpenChange={(o) => !pending && !o && setGradeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Grading Result</DialogTitle>
            <DialogDescription>
              Enter the grade {gradeTarget ? GRADING_COMPANY_LABELS[gradeTarget.gradingCompany] : ""} assigned to{" "}
              {gradeTarget?.itemName}. This creates the digital certificate and the listing.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="grade">Grade (1–10)</Label>
            <Input
              id="grade"
              type="number"
              step="0.5"
              min={1}
              max={10}
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGradeTarget(null)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={completeGrading} disabled={pending || !grade}>
              {pending && <Loader2 className="animate-spin" />}
              Confirm &amp; Mint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectTarget} onOpenChange={(o) => !pending && !o && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Submission</DialogTitle>
            <DialogDescription>
              {rejectTarget?.itemName} will be marked rejected — e.g. the
              grading company found it inauthentic or ungradeable. No digital
              twin will be minted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={reject} disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
