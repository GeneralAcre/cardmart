import { BackofficePageHeader } from "@/components/backoffice/shell";
import { DisputesQueue, type DisputeRow } from "@/components/warehouse/disputes-queue";
import { getDisputes } from "@/lib/queries";
import { requireAdmin } from "@/lib/session";
import { getT } from "@/lib/i18n/server";

type Dispute = Awaited<ReturnType<typeof getDisputes>>["open"][number];

function toRow(d: Dispute): DisputeRow {
  return {
    ...d,
    createdAt: d.createdAt.toISOString(),
    resolvedAt: d.resolvedAt?.toISOString() ?? null,
    escrowTx: { ...d.escrowTx, releasedAt: d.escrowTx.releasedAt?.toISOString() ?? null },
  };
}

export default async function DisputesPage() {
  const [, disputes, t] = await Promise.all([requireAdmin(), getDisputes(), getT()]);
  return (
    <div className="mx-auto w-full max-w-4xl">
      <BackofficePageHeader
        title={t("Disputes")}
        description={t("Buyers reporting a problem with a completed purchase. Check the item's history and tracking, then record the outcome.")}
      />
      <DisputesQueue open={disputes.open.map(toRow)} resolved={disputes.resolved.map(toRow)} />
    </div>
  );
}
