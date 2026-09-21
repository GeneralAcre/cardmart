"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, ShieldOff, UserCheck, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RatingStars } from "@/components/store/rating-stars";
import { toggleUserBan } from "@/lib/actions";
import { formatDate } from "@/lib/format";

export interface SellerManagementRow {
  id: string;
  name: string | null;
  handle: string | null;
  email: string | null;
  createdAt: string;
  isAdmin: boolean;
  isBanned: boolean;
  listingCount: number;
  saleCount: number;
  rating: number | null;
  reviewCount: number;
}

// Staff-only — real counts pulled from existing listings/sales/reviews data,
// no separate fabricated "seller score." Ban/unban is reversible and never
// touches a user's existing listings, escrows, or review history.
export function SellerManagement({ users }: { users: SellerManagementRow[] }) {
  const [rows, setRows] = useState(users);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleToggleBan(userId: string) {
    setPendingId(userId);
    startTransition(async () => {
      try {
        const { isBanned } = await toggleUserBan(userId);
        setRows((prev) => prev.map((r) => (r.id === userId ? { ...r, isBanned } : r)));
        toast.success(isBanned ? "Account suspended." : "Account restored.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update this account.");
      } finally {
        setPendingId(null);
      }
    });
  }

  if (rows.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-24 text-center">
        <Users className="size-8" />
        <p className="text-sm">No onboarded users yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Rating</TableHead>
            <TableHead>Listings</TableHead>
            <TableHead>Sales</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((u) => (
            <TableRow key={u.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{u.name ?? u.handle ?? "—"}</span>
                  <span className="text-muted-foreground text-xs">
                    {u.handle ? `@${u.handle}` : u.email}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <RatingStars average={u.rating} count={u.reviewCount} />
              </TableCell>
              <TableCell className="text-sm">{u.listingCount}</TableCell>
              <TableCell className="text-sm">{u.saleCount}</TableCell>
              <TableCell className="text-muted-foreground text-xs">{formatDate(u.createdAt)}</TableCell>
              <TableCell>
                {u.isAdmin ? (
                  <Badge variant="outline">Staff</Badge>
                ) : u.isBanned ? (
                  <Badge variant="destructive">Suspended</Badge>
                ) : (
                  <Badge variant="secondary">Active</Badge>
                )}
              </TableCell>
              <TableCell>
                {!u.isAdmin && (
                  <Button
                    size="sm"
                    variant={u.isBanned ? "outline" : "destructive"}
                    disabled={pendingId === u.id}
                    onClick={() => handleToggleBan(u.id)}
                  >
                    {pendingId === u.id ? (
                      <Loader2 className="animate-spin" />
                    ) : u.isBanned ? (
                      <UserCheck />
                    ) : (
                      <ShieldOff />
                    )}
                    {u.isBanned ? "Restore" : "Suspend"}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
