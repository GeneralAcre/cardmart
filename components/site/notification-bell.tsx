"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions";
import { formatDateTime } from "@/lib/format";

export interface NotificationSummary {
  id: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

// Consumer-facing only — reads/marks the current user's own USER-audience
// notifications. Staff alerts have a completely separate component
// (components/warehouse/admin-alerts.tsx) and never appear here.
export function NotificationBell({
  initialNotifications,
  initialUnreadCount,
}: {
  initialNotifications: NotificationSummary[];
  initialUnreadCount: number;
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [, startTransition] = useTransition();

  function handleOpen(n: NotificationSummary) {
    if (n.readAt) return;
    setNotifications((prev) =>
      prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    startTransition(() => {
      void markNotificationRead(n.id);
    });
  }

  function handleMarkAllRead() {
    setNotifications((prev) => prev.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })));
    setUnreadCount(0);
    startTransition(() => {
      void markAllNotificationsRead();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full">
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -right-0.5 -top-0.5 size-4 min-w-4 justify-center rounded-full p-0 text-[10px]">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between gap-2 px-2 py-1">
          <DropdownMenuLabel className="p-0 text-sm font-semibold">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2"
            >
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <p className="text-muted-foreground px-2 py-6 text-center text-sm">Nothing yet.</p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {notifications.map((n) => {
              const unread = !n.readAt;
              const body = (
                <div className="flex w-full flex-col gap-0.5 py-0.5">
                  <div className="flex items-center gap-1.5">
                    {unread && <span className="bg-foreground size-1.5 shrink-0 rounded-full" />}
                    <span className="line-clamp-1 text-sm font-medium">{n.title}</span>
                  </div>
                  <p className="text-muted-foreground line-clamp-2 text-xs">{n.body}</p>
                  <span className="text-muted-foreground text-[10px]">{formatDateTime(n.createdAt)}</span>
                </div>
              );
              return n.href ? (
                <DropdownMenuItem key={n.id} asChild className="items-start" onSelect={() => handleOpen(n)}>
                  <Link href={n.href}>{body}</Link>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem key={n.id} className="items-start" onSelect={() => handleOpen(n)}>
                  {body}
                </DropdownMenuItem>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
