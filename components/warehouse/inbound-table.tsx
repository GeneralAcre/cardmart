"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Search } from "lucide-react";

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
import { CardArt } from "@/components/asset/card-art";
import { formatDateTime, formatThb } from "@/lib/format";
import {
  InspectionDialog,
  type InboundPackageWithRelations,
} from "@/components/warehouse/inspection-dialog";

export function InboundTable({ packages }: { packages: InboundPackageWithRelations[] }) {
  const [active, setActive] = useState<InboundPackageWithRelations | null>(null);

  if (packages.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-24 text-center">
        <CheckCircle2 className="size-8" />
        <p className="text-sm">Inbound queue is empty. Nothing awaiting inspection.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Buyer / Seller</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Arrived</TableHead>
            <TableHead>Data Check</TableHead>
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
              <TableRow key={pkg.id}>
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
                    <span>Buyer: {pkg.escrowTx.buyer.name}</span>
                    <span className="text-muted-foreground">Seller: {pkg.escrowTx.seller.name}</span>
                  </div>
                </TableCell>
                <TableCell>{formatThb(pkg.escrowTx.amountThb)}</TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {formatDateTime(pkg.arrivedAt)}
                </TableCell>
                <TableCell>
                  {allMatch ? (
                    <Badge className="border-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                      <CheckCircle2 /> Match
                    </Badge>
                  ) : (
                    <Badge className="border-0 bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300">
                      <AlertTriangle /> Mismatch
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" onClick={() => setActive(pkg)}>
                    <Search /> Inspect
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
  );
}
