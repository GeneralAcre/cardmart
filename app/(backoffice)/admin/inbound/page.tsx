import { BackofficePageHeader } from "@/components/backoffice/shell";
import { InboundTable } from "@/components/warehouse/inbound-table";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { expireOverdueSellerShipments } from "@/lib/actions";
import { getAwaitingSellerShipments, getWarehouseQueue } from "@/lib/queries";
import { requireAdmin } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { formatDateTime, formatThb } from "@/lib/format";
import { hoursUntil, packageReference } from "@/lib/shipping";

export default async function InboundPage() {
  await requireAdmin();
  await expireOverdueSellerShipments({ revalidate: false });
  const [queue, awaiting, t] = await Promise.all([getWarehouseQueue(), getAwaitingSellerShipments(), getT()]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
      <div>
        <BackofficePageHeader
          title={t("Inbound Queue")}
          description={t("Verify each inbound package against the official grading database before paying the seller.")}
        />
        <InboundTable packages={queue} />
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">
            {t("Waiting for sellers to ship")} ({awaiting.length})
          </h2>
          <p className="text-muted-foreground text-xs">
            {t("Sold, but not sent in yet. These join the queue above once the seller adds tracking; past the deadline the buyer is refunded automatically.")}
          </p>
        </div>
        {awaiting.length > 0 && (
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Item")}</TableHead>
                  <TableHead>{t("Seller")}</TableHead>
                  <TableHead>{t("Amount")}</TableHead>
                  <TableHead>{t("Ship by")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {awaiting.map((pkg) => {
                  const hoursLeft = pkg.shipByDeadline ? hoursUntil(pkg.shipByDeadline) : null;
                  const seller = pkg.escrowTx.seller;
                  return (
                    <TableRow key={pkg.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{pkg.asset.name}</span>
                          <span className="text-muted-foreground font-mono text-xs">{packageReference(pkg.id)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-xs">
                          <span>{seller.name ?? (seller.handle ? `@${seller.handle}` : "—")}</span>
                          <span className="text-muted-foreground">{[seller.email, seller.phone].filter(Boolean).join(" · ")}</span>
                        </div>
                      </TableCell>
                      <TableCell>{formatThb(pkg.escrowTx.amountThb)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-xs">
                          <span>{pkg.shipByDeadline ? formatDateTime(pkg.shipByDeadline) : "—"}</span>
                          {hoursLeft != null && hoursLeft < 24 && (
                            <Badge variant="destructive" className="w-fit">
                              {t("{hours}h left", { hours: Math.max(hoursLeft, 0) })}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
