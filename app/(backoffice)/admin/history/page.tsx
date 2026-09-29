import { BackofficePageHeader } from "@/components/backoffice/shell";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getWarehouseHistory } from "@/lib/queries";
import { requireAdmin } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { formatDateTime, formatThb } from "@/lib/format";
import { INBOUND_STATUS_LABELS } from "@/lib/labels";

export default async function HistoryPage() {
  const [, history, t] = await Promise.all([requireAdmin(), getWarehouseHistory(), getT()]);
  return (
    <div className="mx-auto w-full max-w-6xl">
      <BackofficePageHeader title={t("Recently Resolved")} description={t("The last 20 inspection decisions.")} />
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("Item")}</TableHead>
              <TableHead>{t("Buyer / Seller")}</TableHead>
              <TableHead>{t("Amount")}</TableHead>
              <TableHead>{t("Resolved")}</TableHead>
              <TableHead>{t("Outcome")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map((pkg) => (
              <TableRow key={pkg.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{pkg.asset.name}</span>
                    <span className="text-muted-foreground font-mono text-xs">{pkg.asset.serial}</span>
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
                  {pkg.resolvedAt ? formatDateTime(pkg.resolvedAt) : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={pkg.status === "REJECTED" ? "destructive" : "secondary"}>
                    {t(INBOUND_STATUS_LABELS[pkg.status])}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {history.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground py-10 text-center text-sm">
                  {t("Nothing resolved yet.")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
