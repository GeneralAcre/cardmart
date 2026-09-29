import { BackofficePageHeader } from "@/components/backoffice/shell";
import { AdminAlerts } from "@/components/warehouse/admin-alerts";
import { getAdminAlerts } from "@/lib/queries";
import { requireAdmin } from "@/lib/session";
import { getT } from "@/lib/i18n/server";

export default async function AlertsPage() {
  const [, alerts, t] = await Promise.all([requireAdmin(), getAdminAlerts(50), getT()]);
  return (
    <div className="mx-auto w-full max-w-4xl">
      <BackofficePageHeader title={t("Alerts")} description={t("Everything the platform flagged for staff, newest first.")} />
      <AdminAlerts
        alerts={alerts.map((a) => ({
          id: a.id,
          title: a.title,
          body: a.body,
          href: a.href,
          readAt: a.readAt?.toISOString() ?? null,
          createdAt: a.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
