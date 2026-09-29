import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Bell, LifeBuoy, PackageCheck, Scale, ScanSearch, ShieldCheck, Truck, Vault } from "lucide-react";

import { BackofficePageHeader } from "@/components/backoffice/shell";
import { getAdminAlerts, getBackofficeCounts, type BackofficeCounts } from "@/lib/queries";
import { requireAdmin } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const TILES: { key: keyof BackofficeCounts; href: string; label: string; hint: string; icon: LucideIcon }[] = [
  { key: "inbound", href: "/admin/inbound", label: "Awaiting inspection", hint: "Sold cards to check", icon: ScanSearch },
  { key: "shipments", href: "/admin/shipments", label: "Awaiting dispatch", hint: "Need a tracking number", icon: Truck },
  { key: "disputes", href: "/admin/disputes", label: "Open disputes", hint: "Buyers reporting a problem", icon: Scale },
  { key: "kyc", href: "/admin/identity", label: "Identity checks", hint: "ID + selfie to review", icon: ShieldCheck },
  { key: "support", href: "/admin/support", label: "Support messages", hint: "Not yet handled", icon: LifeBuoy },
  { key: "grading", href: "/admin/grading", label: "Grading in progress", hint: "Full-Service submissions", icon: PackageCheck },
  { key: "alerts", href: "/admin/alerts", label: "Unread alerts", hint: "Staff notifications", icon: Bell },
  { key: "vault", href: "/admin/vault", label: "Cards in the vault", hint: "Stored in the warehouse", icon: Vault },
];

// The vault total is inventory, not a to-do list, so it never lights up.
const NOT_A_QUEUE: (keyof BackofficeCounts)[] = ["vault"];

export default async function BackofficeOverviewPage() {
  const [, counts, alerts, t] = await Promise.all([requireAdmin(), getBackofficeCounts(), getAdminAlerts(6), getT()]);
  const waiting = counts.inbound + counts.shipments + counts.disputes + counts.kyc + counts.support;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <BackofficePageHeader
        title={t("Overview")}
        description={
          waiting > 0
            ? t("{count} items need a staff decision right now.", { count: waiting })
            : t("All queues are clear.")
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TILES.map((tile) => {
          const Icon = tile.icon;
          const value = counts[tile.key];
          const needsAction = value > 0 && !NOT_A_QUEUE.includes(tile.key);
          return (
            <Link
              key={tile.key}
              href={tile.href}
              className={cn(
                "bg-card group flex flex-col gap-3 rounded-xl border p-4 transition-colors hover:border-foreground/40",
                needsAction && "border-highlight/50",
              )}
            >
              <div className="flex items-center justify-between">
                <Icon className={cn("size-4", needsAction ? "text-highlight" : "text-muted-foreground")} />
                <ArrowRight className="text-muted-foreground size-4 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <span className="text-3xl font-semibold tabular-nums">{value}</span>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{t(tile.label)}</span>
                <span className="text-muted-foreground text-xs">{t(tile.hint)}</span>
              </div>
            </Link>
          );
        })}
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t("Latest alerts")}</h2>
          <Link href="/admin/alerts" className="text-muted-foreground hover:text-foreground text-xs">
            {t("See all")}
          </Link>
        </div>
        {alerts.length === 0 ? (
          <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
            {t("No alerts yet.")}
          </p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {alerts.map((a) => (
              <li key={a.id}>
                <Link
                  href={a.href ?? "/admin/alerts"}
                  className="hover:bg-accent/40 flex items-start gap-3 px-4 py-3 transition-colors"
                >
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      a.readAt ? "bg-muted-foreground/40" : "bg-highlight",
                    )}
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-medium">{a.title}</span>
                    <span className="text-muted-foreground truncate text-xs">{a.body}</span>
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">{formatDateTime(a.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
