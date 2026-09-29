import { BackofficePageHeader } from "@/components/backoffice/shell";
import { IntegrationsPanel } from "@/components/warehouse/integrations-panel";
import { requireAdmin } from "@/lib/session";
import { getT } from "@/lib/i18n/server";

export default async function IntegrationsPage() {
  const [, t] = await Promise.all([requireAdmin(), getT()]);
  return (
    <div className="mx-auto w-full max-w-4xl">
      <BackofficePageHeader title={t("Integrations")} />
      <IntegrationsPanel />
    </div>
  );
}
