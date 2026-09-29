import { BackofficePageHeader } from "@/components/backoffice/shell";
import { VaultInventory } from "@/components/warehouse/vault-inventory";
import { getVaultInventory } from "@/lib/queries";
import { requireAdmin } from "@/lib/session";
import { getT } from "@/lib/i18n/server";

export default async function VaultPage() {
  const [, items, t] = await Promise.all([requireAdmin(), getVaultInventory(), getT()]);
  return (
    <div className="mx-auto w-full max-w-6xl">
      <BackofficePageHeader
        title={t("Vault Inventory")}
        description={t("Where each stored card physically sits, so it can be found when it sells or is redeemed.")}
      />
      <VaultInventory
        items={items.map((a) => ({
          id: a.id,
          name: a.name,
          serial: a.serial,
          gradingCompany: a.gradingCompany,
          grade: a.grade,
          vaultLocation: a.vaultLocation,
          owner: { name: a.owner.name, handle: a.owner.handle },
        }))}
      />
    </div>
  );
}
