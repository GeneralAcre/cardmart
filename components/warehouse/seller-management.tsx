"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Loader2,
  ShieldCheck,
  ShieldMinus,
  ShieldOff,
  UserCheck,
  Users,
} from "lucide-react";

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
import { toggleUserAdmin, toggleUserBan } from "@/lib/actions";
import { formatDate } from "@/lib/format";
import { useT } from "@/components/landing/language-provider";

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
// touches a user's existing listings, escrows, or review history. Staff
// access is granted here too; nobody can change their own row.
export function SellerManagement({
  users,
  currentUserId,
}: {
  users: SellerManagementRow[];
  currentUserId: string;
}) {
  const [rows, setRows] = useState(users);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const t = useT();

  function handleToggleBan(userId: string) {
    setPendingId(userId);
    startTransition(async () => {
      try {
        const { isBanned } = await toggleUserBan(userId);
        setRows((prev) =>
          prev.map((r) => (r.id === userId ? { ...r, isBanned } : r)),
        );
        toast.success(
          isBanned ? t("Account suspended.") : t("Account restored."),
        );
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : t("Could not update this account."),
        );
      } finally {
        setPendingId(null);
      }
    });
  }

  function handleToggleAdmin(userId: string) {
    setPendingId(userId);
    startTransition(async () => {
      try {
        const { isAdmin } = await toggleUserAdmin(userId);
        setRows((prev) =>
          prev.map((r) => (r.id === userId ? { ...r, isAdmin } : r)),
        );
        toast.success(
          isAdmin ? t("Staff access granted.") : t("Staff access removed."),
        );
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : t("Could not update this account."),
        );
      } finally {
        setPendingId(null);
      }
    });
  }

  if (rows.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-24 text-center">
        <Users className="size-8" />
        <p className="text-sm">{t("No onboarded users yet.")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("User")}</TableHead>
            <TableHead>{t("Rating")}</TableHead>
            <TableHead>{t("Listings")}</TableHead>
            <TableHead>{t("Sales")}</TableHead>
            <TableHead>{t("Joined")}</TableHead>
            <TableHead>{t("Status")}</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((u) => (
            <TableRow key={u.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">
                    {u.name ?? u.handle ?? "—"}
                  </span>
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
              <TableCell className="text-muted-foreground text-xs">
                {formatDate(u.createdAt)}
              </TableCell>
              <TableCell>
                {u.isAdmin ? (
                  <Badge variant="outline">{t("Staff")}</Badge>
                ) : u.isBanned ? (
                  <Badge variant="destructive">{t("Suspended")}</Badge>
                ) : (
                  <Badge variant="secondary">{t("Active")}</Badge>
                )}
              </TableCell>
              <TableCell>
                {u.id === currentUserId ? (
                  <span className="text-muted-foreground text-xs">
                    {t("You")}
                  </span>
                ) : (
                  <div className="flex justify-end gap-2">
                    {!u.isBanned && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pendingId === u.id}
                        onClick={() => handleToggleAdmin(u.id)}
                      >
                        {u.isAdmin ? <ShieldMinus /> : <ShieldCheck />}
                        {u.isAdmin ? t("Remove staff") : t("Make staff")}
                      </Button>
                    )}
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
                        {u.isBanned ? t("Restore") : t("Suspend")}
                      </Button>
                    )}
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
