"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AlertTriangle, Bell, CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { markAdminAlertRead } from "@/lib/actions";
import { formatDateTime } from "@/lib/format";

export interface AdminAlertSummary {
  id: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

// Staff-only ADMIN-audience alerts — a completely separate surface from
// components/site/notification-bell.tsx's consumer USER-audience list, even
// though both read the same underlying Notification table.
export function AdminAlerts({ alerts: initialAlerts }: { alerts: AdminAlertSummary[] }) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [, startTransition] = useTransition();

  function dismiss(id: string) {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, readAt: new Date().toISOString() } : a)));
    startTransition(() => {
      void markAdminAlertRead(id);
    });
  }

  if (alerts.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-24 text-center">
        <Bell className="size-8" />
        <p className="text-sm">No alerts. New high-value submissions and fraud signals show up here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {alerts.map((a) => {
        const unread = !a.readAt;
        const isFraud = a.title.toLowerCase().includes("duplicate");
        return (
          <div
            key={a.id}
            className={`bg-card flex items-start gap-3 rounded-xl border p-4 ${unread ? "" : "opacity-60"}`}
          >
            <div className="bg-foreground text-background mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg">
              {isFraud ? <AlertTriangle className="size-4" /> : <Bell className="size-4" />}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{a.title}</span>
                {unread && <Badge className="text-[10px]">New</Badge>}
              </div>
              <p className="text-muted-foreground text-sm">{a.body}</p>
              <div className="flex items-center gap-3 pt-1">
                <span className="text-muted-foreground text-xs">{formatDateTime(a.createdAt)}</span>
                {a.href && (
                  <Link href={a.href} className="text-xs underline underline-offset-2">
                    View
                  </Link>
                )}
              </div>
            </div>
            {unread && (
              <Button variant="ghost" size="sm" onClick={() => dismiss(a.id)}>
                <CheckCircle2 /> Dismiss
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
