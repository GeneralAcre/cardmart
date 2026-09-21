"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, MapPin, Save, Vault } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { updateVaultLocation } from "@/lib/actions";
import { formatGrade } from "@/lib/format";

export interface VaultInventoryItem {
  id: string;
  name: string;
  serial: string;
  gradingCompany: string;
  grade: number | null;
  vaultLocation: string | null;
  owner: { name: string | null; handle: string | null };
}

// Staff-only — "so staff can physically locate stored cards when they are
// sold or requested for withdrawal." Never joined into any buyer/seller
// page; this is the only place Asset.vaultLocation is read or written.
export function VaultInventory({ items }: { items: VaultInventoryItem[] }) {
  const [locations, setLocations] = useState<Record<string, string>>(
    Object.fromEntries(items.map((i) => [i.id, i.vaultLocation ?? ""])),
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(assetId: string) {
    setSavingId(assetId);
    startTransition(async () => {
      try {
        await updateVaultLocation(assetId, locations[assetId] ?? "");
        toast.success("Location updated.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update location.");
      } finally {
        setSavingId(null);
      }
    });
  }

  if (items.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-24 text-center">
        <Vault className="size-8" />
        <p className="text-sm">Nothing in the vault right now.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" /> Location
              </span>
            </TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{item.name}</span>
                  <span className="text-muted-foreground font-mono text-xs">
                    {item.gradingCompany === "RAW" ? "RAW" : `${item.gradingCompany} ${formatGrade(item.grade)}`} ·{" "}
                    {item.serial}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-sm">{item.owner.name ?? item.owner.handle ?? "—"}</TableCell>
              <TableCell>
                <Input
                  value={locations[item.id] ?? ""}
                  onChange={(e) => setLocations((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  placeholder="e.g. Row 3, Shelf B, Box 12"
                  className="h-8 w-48 text-xs"
                />
              </TableCell>
              <TableCell>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending && savingId === item.id}
                  onClick={() => save(item.id)}
                >
                  {pending && savingId === item.id ? <Loader2 className="animate-spin" /> : <Save />}
                  Save
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
