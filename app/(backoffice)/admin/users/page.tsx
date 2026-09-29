import { BackofficePageHeader } from "@/components/backoffice/shell";
import { SellerManagement } from "@/components/warehouse/seller-management";
import { getSellerManagementList } from "@/lib/queries";
import { requireAdmin } from "@/lib/session";
import { getT } from "@/lib/i18n/server";

export default async function UsersPage() {
  const [staff, users, t] = await Promise.all([requireAdmin(), getSellerManagementList(), getT()]);
  return (
    <div className="mx-auto w-full max-w-6xl">
      <BackofficePageHeader
        title={t("Users")}
        description={t("Suspend accounts, or give a teammate staff access to this back office.")}
      />
      <SellerManagement
        currentUserId={staff.id}
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          handle: u.handle,
          email: u.email,
          createdAt: u.createdAt.toISOString(),
          isAdmin: u.isAdmin,
          isBanned: u.isBanned,
          listingCount: u._count.listedAssets,
          saleCount: u._count.sales,
          rating: u.rating,
          reviewCount: u.reviewCount,
        }))}
      />
    </div>
  );
}
