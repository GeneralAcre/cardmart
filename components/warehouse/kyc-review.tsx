"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, UserCheck, X } from "lucide-react";
import type { KycIdType, KycStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { reviewKyc } from "@/lib/actions";
import { formatDate, formatDateTime } from "@/lib/format";
import { KYC_ID_TYPE_LABELS, KYC_STATUS_LABELS } from "@/lib/labels";

export interface KycRow {
  id: string;
  name: string | null;
  handle: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string;
  kycStatus: KycStatus;
  kycLegalName: string | null;
  kycDateOfBirth: string | null;
  kycIdType: KycIdType | null;
  kycIdLast4: string | null;
  kycSubmittedAt: string | null;
  kycReviewedAt: string | null;
  kycRejectReason: string | null;
}

function age(dob: string) {
  const d = new Date(dob);
  const now = new Date();
  let years = now.getFullYear() - d.getFullYear();
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) years -= 1;
  return years;
}

// Staff-only. The reviewer compares the submitted legal name against the
// account (display name, email, shipping phone) and approves or declines
// with a reason the user sees.
export function KycReview({ pending, reviewed }: { pending: KycRow[]; reviewed: KycRow[] }) {
  return (
    <div className="flex flex-col gap-8">
      <section>
        <h3 className="mb-3 text-sm font-semibold">Awaiting review ({pending.length})</h3>
        {pending.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center">
            <UserCheck className="size-6" />
            <p className="text-sm">No identity submissions waiting.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pending.map((row) => (
              <PendingRow key={row.id} row={row} />
            ))}
          </div>
        )}
      </section>

      {reviewed.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold">Recently reviewed</h3>
          <div className="overflow-x-auto rounded-xl border">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Legal name</TableHead>
                  <TableHead>Reviewed</TableHead>
                  <TableHead>Outcome</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviewed.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{row.name ?? "—"}</span>
                        <span className="text-muted-foreground text-xs">{row.handle ? `@${row.handle}` : row.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>{row.kycLegalName ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {row.kycReviewedAt ? formatDateTime(row.kycReviewedAt) : "—"}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <Badge variant={row.kycStatus === "REJECTED" ? "destructive" : "secondary"}>
                        {KYC_STATUS_LABELS[row.kycStatus]}
                      </Badge>
                      {row.kycRejectReason && (
                        <p className="text-muted-foreground mt-1 text-xs">{row.kycRejectReason}</p>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </div>
  );
}

function PendingRow({ row }: { row: KycRow }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [pending, startTransition] = useTransition();

  function review(action: "approve" | "reject") {
    startTransition(async () => {
      try {
        await reviewKyc(row.id, action, action === "reject" ? reason : undefined);
        toast.success(action === "approve" ? "Identity verified." : "Verification declined.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update verification.");
      }
    });
  }

  const facts: [string, string][] = [
    ["Legal name", row.kycLegalName ?? "—"],
    ["Date of birth", row.kycDateOfBirth ? `${formatDate(row.kycDateOfBirth)} (age ${age(row.kycDateOfBirth)})` : "—"],
    ["ID", row.kycIdType ? `${KYC_ID_TYPE_LABELS[row.kycIdType]} ending ${row.kycIdLast4 ?? "????"}` : "—"],
    ["Account name", row.name ?? "—"],
    ["Email", row.email ?? "—"],
    ["Phone", row.phone ?? "—"],
  ];

  return (
    <div className="bg-card flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">
          {row.name ?? "Unnamed user"}
          {row.handle && <span className="text-muted-foreground ml-1.5 text-sm font-normal">@{row.handle}</span>}
        </span>
        <span className="text-muted-foreground text-xs">
          Submitted {row.kycSubmittedAt ? formatDateTime(row.kycSubmittedAt) : "—"} · member since {formatDate(row.createdAt)}
        </span>
      </div>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        {facts.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-muted-foreground text-xs">{label}</dt>
            <dd className="truncate font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      {rejecting && (
        <Input
          placeholder="Reason shown to the user (e.g. name doesn't match the account)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      )}
      <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
        {rejecting ? (
          <>
            <Button size="sm" variant="outline" onClick={() => setRejecting(false)} disabled={pending}>
              Cancel
            </Button>
            <Button size="sm" variant="destructive" onClick={() => review("reject")} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <X />}
              Confirm decline
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="outline" onClick={() => setRejecting(true)} disabled={pending}>
              <X /> Decline
            </Button>
            <Button size="sm" onClick={() => review("approve")} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Check />}
              Approve
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
