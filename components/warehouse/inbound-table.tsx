"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, Search, ShieldCheck, XOctagon } from "lucide-react";

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
import { CardArt } from "@/components/asset/card-art";
import { bulkApproveInboundPackages, bulkRejectInboundPackages, type BulkActionResult } from "@/lib/actions";
import { formatDateTime, formatThb } from "@/lib/format";
import {
  InspectionDialog,
  type InboundPackageWithRelations,
} from "@/components/warehouse/inspection-dialog";
import { useT } from "@/components/landing/language-provider";
import type { Translate } from "@/lib/i18n/translate";

function reportBulkResult(result: BulkActionResult, verb: "Approved" | "Rejected", t: Translate) {
  if (result.succeeded.length > 0) {
    toast.success(t(verb === "Approved" ? "Approved {count} item(s)." : "Rejected {count} item(s).", { count: result.succeeded.length }));
  }
  if (result.skipped.length > 0) {
    toast.error(
      `${t("Skipped {count}:", { count: result.skipped.length })} ${result.skipped
        .slice(0, 3)
        .map((s) => `${s.itemName} (${s.reason})`)
        .join("; ")}${result.skipped.length > 3 ? "…" : ""}`,
    );
  }
}

export function InboundTable({ packages }: { packages: InboundPackageWithRelations[] }) {
  const router = useRouter();
  const [active, setActive] = useState<InboundPackageWithRelations | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"approve" | "reject" | null>(null);
  const [pending, startTransition] = useTransition();
  const t = useT();

  if (packages.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-24 text-center">
        <CheckCircle2 className="size-8" />
        <p className="text-sm">{t("Inbound queue is empty. Nothing awaiting inspection.")}</p>
      </div>
    );
  }

  const allSelected = selected.size > 0 && selected.size === packages.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(packages.map((p) => p.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function runBulk(kind: "approve" | "reject") {
    const ids = Array.from(selected);
    setBulkAction(kind);
    startTransition(async () => {
      try {
        const result =
          kind === "approve" ? await bulkApproveInboundPackages(ids) : await bulkRejectInboundPackages(ids);
        reportBulkResult(result, kind === "approve" ? "Approved" : "Rejected", t);
        setSelected(new Set());
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("Bulk action failed."));
      } finally {
        setBulkAction(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {selected.size > 0 && (
        <div className="bg-card flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
          <span className="text-sm font-medium">{t("{count} selected", { count: selected.size })}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => runBulk("reject")} disabled={pending}>
              {pending && bulkAction === "reject" ? <Loader2 className="animate-spin" /> : <XOctagon />}
              {t("Reject Selected")}
            </Button>
            <Button size="sm" onClick={() => runBulk("approve")} disabled={pending}>
              {pending && bulkAction === "approve" ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
              {t("Approve Selected")}
            </Button>
          </div>
        </div>
      )}
      {selected.size > 0 && (
        <p className="text-muted-foreground -mt-1 text-xs">
          {t("“Approve Selected” only clears items with no data mismatch — anything flagged still needs individual review.")}
        </p>
      )}

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label={t("Select all")} />
              </TableHead>
              <TableHead>{t("Item")}</TableHead>
              <TableHead>{t("Buyer / Seller")}</TableHead>
              <TableHead>{t("Amount")}</TableHead>
              <TableHead>{t("Arrived")}</TableHead>
              <TableHead>{t("Data Check")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {packages.map((pkg) => {
              const allMatch =
                pkg.declaredSerial === pkg.officialSerial &&
                pkg.declaredGradingCompany === pkg.officialGradingCompany &&
                pkg.declaredGrade === pkg.officialGrade;
              return (
                <TableRow key={pkg.id} data-state={selected.has(pkg.id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(pkg.id)}
                      onCheckedChange={() => toggleOne(pkg.id)}
                      aria-label={t("Select {name}", { name: pkg.asset.name })}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10">
                        <CardArt
                          themeIndex={pkg.asset.themeIndex}
                          category={pkg.asset.category}
                          gradingCompany={pkg.asset.gradingCompany}
                          grade={pkg.asset.grade}
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium">{pkg.asset.name}</span>
                        <span className="text-muted-foreground font-mono text-xs">{pkg.asset.serial}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-xs">
                      <span>{t("Buyer:")} {pkg.escrowTx.buyer.name}</span>
                      <span className="text-muted-foreground">{t("Seller:")} {pkg.escrowTx.seller.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{formatThb(pkg.escrowTx.amountThb)}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatDateTime(pkg.arrivedAt)}
                  </TableCell>
                  <TableCell>
                    {allMatch ? (
                      <Badge className="border-0 bg-success/15 text-success">
                        <CheckCircle2 /> {t("Match")}
                      </Badge>
                    ) : (
                      <Badge className="border-0 bg-destructive/15 text-destructive">
                        <AlertTriangle /> {t("Mismatch")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => setActive(pkg)}>
                      <Search /> {t("Inspect")}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {active && (
          <InspectionDialog pkg={active} open={!!active} onOpenChange={(o) => !o && setActive(null)} />
        )}
      </div>
    </div>
  );
}
