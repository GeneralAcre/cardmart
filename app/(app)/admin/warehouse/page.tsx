import {
  getGradingSubmissionQueue,
  getWarehouseHistory,
  getWarehouseQueue,
} from "@/lib/queries";
import { InboundTable } from "@/components/warehouse/inbound-table";
import { GradingQueue } from "@/components/warehouse/grading-queue";
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

export default async function WarehouseAdminPage() {
  const [queue, history, gradingQueue] = await Promise.all([
    getWarehouseQueue(),
    getWarehouseHistory(),
    getGradingSubmissionQueue(),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Physical Warehouse Inspection</h1>
        <p className="text-muted-foreground text-sm">
          Verify each inbound package against the official grading database
          before releasing escrow to the seller.
        </p>
      </div>

      <Tabs defaultValue="queue">
        <TabsList>
          <TabsTrigger value="queue">Inbound Queue ({queue.length})</TabsTrigger>
          <TabsTrigger value="grading">Grading Submissions ({gradingQueue.length})</TabsTrigger>
          <TabsTrigger value="history">Recently Resolved</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="pt-6">
          <InboundTable packages={queue} />
        </TabsContent>

        <TabsContent value="grading" className="pt-6">
          <GradingQueue submissions={gradingQueue} />
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
