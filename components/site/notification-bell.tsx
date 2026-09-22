"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full">
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -right-0.5 -top-0.5 size-4 min-w-4 justify-center rounded-full p-0 text-[10px]">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:w-[28rem] sm:max-w-none">
        <SheetHeader className="border-b p-5 pr-12">
          <div className="flex items-center justify-between gap-3">
            <SheetTitle>Notifications</SheetTitle>
            {unreadCount > 0 && <Badge variant="secondary">{unreadCount} new</Badge>}
          </div>
          <p className="text-muted-foreground text-sm">Updates about your collection, offers, and auctions.</p>
        </SheetHeader>
        <div className="flex items-center justify-between border-b px-5 py-3">
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Recent activity</span>
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
        {notifications.length === 0 ? (
          <div className="text-muted-foreground flex flex-1 items-center justify-center px-6 text-center text-sm">
            Nothing yet. Auction, offer, and collection updates will appear here.
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {notifications.map((n) => {
              const unread = !n.readAt;
              const body = (
                <div className="flex w-full flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    {unread && <span className="bg-foreground size-1.5 shrink-0 rounded-full" />}
                    <span className="text-sm font-semibold">{n.title}</span>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">{n.body}</p>
                  <span className="text-muted-foreground pt-1 text-xs">{formatDateTime(n.createdAt)}</span>
                </div>
              );
              return n.href ? (
                <SheetClose key={n.id} asChild>
                  <Link
                    href={n.href}
                    onClick={() => handleOpen(n)}
                    className={`hover:bg-accent/60 block border-b px-5 py-4 transition-colors ${unread ? "bg-card" : ""}`}
                  >
                    {body}
                  </Link>
                </SheetClose>
              ) : (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleOpen(n)}
                  className={`hover:bg-accent/60 block w-full border-b px-5 py-4 text-left transition-colors ${unread ? "bg-card" : ""}`}
                >
                  {body}
                </button>
              );
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
