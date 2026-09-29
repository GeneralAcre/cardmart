import { BackofficePageHeader } from "@/components/backoffice/shell";
import { ShipmentsBoard, type ShipmentRow } from "@/components/warehouse/shipments-table";
import { getShipments } from "@/lib/queries";
import { requireAdmin } from "@/lib/session";
import { getT } from "@/lib/i18n/server";

type Shipment = Awaited<ReturnType<typeof getShipments>>["open"][number];

function toRow(s: Shipment): ShipmentRow {
  return {
    id: s.id,
    reason: s.reason,
    status: s.status,
    shippingAddress: s.shippingAddress,
    phone: s.phone,
    carrier: s.carrier,
    trackingNumber: s.trackingNumber,
    createdAt: s.createdAt.toISOString(),
    shippedAt: s.shippedAt?.toISOString() ?? null,
    deliveredAt: s.deliveredAt?.toISOString() ?? null,
    asset: s.asset,
    recipient: s.recipient,
  };
}

export default async function ShipmentsPage() {
  const [, shipments, t] = await Promise.all([requireAdmin(), getShipments(), getT()]);
  return (
    <div className="mx-auto w-full max-w-6xl">
      <BackofficePageHeader
        title={t("Shipments")}
        description={t("Cards leaving the warehouse. Add the courier and tracking number once it's collected; the recipient sees it on the item page.")}
      />
      <ShipmentsBoard open={shipments.open.map(toRow)} delivered={shipments.delivered.map(toRow)} />
    </div>
  );
}
