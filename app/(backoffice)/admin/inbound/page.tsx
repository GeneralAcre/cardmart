import { BackofficePageHeader } from "@/components/backoffice/shell";
import { InboundTable } from "@/components/warehouse/inbound-table";
import { getWarehouseQueue } from "@/lib/queries";
import { requireAdmin } from "@/lib/session";
import { getT } from "@/lib/i18n/server";

export default async function InboundPage() {
  const [, queue, t] = await Promise.all([requireAdmin(), getWarehouseQueue(), getT()]);
  return (
    <div className="mx-auto w-full max-w-6xl">
      <BackofficePageHeader
        title={t("Inbound Queue")}
        description={t("Verify each inbound package against the official grading database before paying the seller.")}
      />
      <InboundTable packages={queue} />
    </div>
  );
}
