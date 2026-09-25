import {
  getAdminAlerts,
  getGradingSubmissionQueue,
  getKycQueue,
  getSellerManagementList,
  getVaultInventory,
  getWarehouseHistory,
  getWarehouseQueue,
} from "@/lib/queries";
import { requireAdmin } from "@/lib/session";
import { InboundTable } from "@/components/warehouse/inbound-table";
import { GradingQueue } from "@/components/warehouse/grading-queue";
import { AdminAlerts } from "@/components/warehouse/admin-alerts";
import { VaultInventory } from "@/components/warehouse/vault-inventory";
import { SellerManagement } from "@/components/warehouse/seller-management";
import { KycReview, type KycRow } from "@/components/warehouse/kyc-review";
import { IntegrationsPanel } from "@/components/warehouse/integrations-panel";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime, formatThb } from "@/lib/format";
import { INBOUND_STATUS_LABELS } from "@/lib/labels";

const TABS = ["queue", "grading", "vault", "kyc", "alerts", "sellers", "history", "integrations"] as const;

function toKycRow(u: Awaited<ReturnType<typeof getKycQueue>>["pending"][number]): KycRow {
  return {
    ...u,
    createdAt: u.createdAt.toISOString(),
    kycDateOfBirth: u.kycDateOfBirth?.toISOString() ?? null,
    kycSubmittedAt: u.kycSubmittedAt?.toISOString() ?? null,
    kycReviewedAt: u.kycReviewedAt?.toISOString() ?? null,
  };
}

export default async function WarehouseAdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin();
  const { tab } = await searchParams;
  const defaultTab = TABS.find((t) => t === tab) ?? "queue";

  const [queue, history, gradingQueue, alerts, vaultItems, sellers, kyc] = await Promise.all([
    getWarehouseQueue(),
    getWarehouseHistory(),
    getGradingSubmissionQueue(),
    getAdminAlerts(),
    getVaultInventory(),
    getSellerManagementList(),
    getKycQueue(),
  ]);
  const unreadAlertCount = alerts.filter((a) => !a.readAt).length;

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Physical Warehouse Inspection</h1>
        <p className="text-muted-foreground text-sm">
          Verify each inbound package against the official grading database
          before paying the seller.
        </p>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="queue">Inbound Queue ({queue.length})</TabsTrigger>
          <TabsTrigger value="grading">Grading Submissions ({gradingQueue.length})</TabsTrigger>
          <TabsTrigger value="vault">Vault Inventory ({vaultItems.length})</TabsTrigger>
          <TabsTrigger value="kyc">Identity ({kyc.pending.length})</TabsTrigger>
          <TabsTrigger value="alerts">
            Alerts {unreadAlertCount > 0 ? `(${unreadAlertCount})` : ""}
          </TabsTrigger>
          <TabsTrigger value="sellers">Sellers ({sellers.length})</TabsTrigger>
          <TabsTrigger value="history">Recently Resolved</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="pt-6">
          <InboundTable packages={queue} />
        </TabsContent>

        <TabsContent value="grading" className="pt-6">
          <GradingQueue submissions={gradingQueue} />
        </TabsContent>

        <TabsContent value="vault" className="pt-6">
          <VaultInventory
            items={vaultItems.map((a) => ({
              id: a.id,
              name: a.name,
              serial: a.serial,
              gradingCompany: a.gradingCompany,
              grade: a.grade,
              vaultLocation: a.vaultLocation,
              owner: { name: a.owner.name, handle: a.owner.handle },
            }))}
          />
        </TabsContent>

        <TabsContent value="kyc" className="pt-6">
          <KycReview pending={kyc.pending.map(toKycRow)} reviewed={kyc.reviewed.map(toKycRow)} />
        </TabsContent>

        <TabsContent value="alerts" className="pt-6">
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
        </TabsContent>

        <TabsContent value="sellers" className="pt-6">
          <SellerManagement
            users={sellers.map((u) => ({
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
        </TabsContent>

        <TabsContent value="integrations" className="pt-6">
          <IntegrationsPanel />
        </TabsContent>

        <TabsContent value="history" className="pt-6">
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Buyer / Seller</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Resolved</TableHead>
                  <TableHead>Outcome</TableHead>
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
                        <span>Buyer: {pkg.escrowTx.buyer.name}</span>
                        <span className="text-muted-foreground">Seller: {pkg.escrowTx.seller.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{formatThb(pkg.escrowTx.amountThb)}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {pkg.resolvedAt ? formatDateTime(pkg.resolvedAt) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={pkg.status === "REJECTED" ? "destructive" : "secondary"}>
                        {INBOUND_STATUS_LABELS[pkg.status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
