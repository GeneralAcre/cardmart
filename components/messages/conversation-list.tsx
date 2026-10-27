"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";

import { displayNameOf, UserAvatar } from "@/components/messages/user-avatar";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useT } from "@/components/landing/language-provider";

export interface ConversationListItem {
  id: string;
  otherUser: { id: string; name: string | null; handle: string | null; image: string | null };
  lastMessageAt: string;
  /** What the last message was, already worded on the server ("You: …", "Sent a photo"); null when empty. */
  preview: string | null;
  unreadCount: number;
}

/**
 * The left pane of Messages: every conversation, newest first, with the open
 * one highlighted. On phones it's the whole page until a chat is opened.
 */
export function ConversationList({ conversations }: { conversations: ConversationListItem[] }) {
  const pathname = usePathname();
  const t = useT();

  if (conversations.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-4 py-16 text-center">
        <MessageCircle className="size-8" />
        <p className="text-sm">{t("No conversations yet.")}</p>
        <p className="max-w-xs text-xs">
          {t("Open a seller's profile or a listing and tap “Message Seller” to ask a question or negotiate a price.")}
        </p>
        <Link href="/marketplace" className="text-foreground text-sm underline">
          {t("Browse the marketplace")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {conversations.map((c) => {
        const unread = c.unreadCount > 0;
        const active = pathname === `/messages/${c.id}`;
        return (
          <Link
            key={c.id}
            href={`/messages/${c.id}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-3 transition-colors",
              active ? "bg-muted border-foreground/30" : "bg-card hover:bg-muted/40",
            )}
          >
            <UserAvatar user={c.otherUser} className="size-10" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className={cn("truncate text-sm", unread ? "font-semibold" : "font-medium")}>{displayNameOf(c.otherUser)}</span>
                <span className="text-muted-foreground shrink-0 text-[11px]">{formatDateTime(c.lastMessageAt)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className={cn("truncate text-xs", unread ? "text-foreground" : "text-muted-foreground")}>
                  {c.preview ?? t("No messages yet")}
                </span>
                {unread && <Badge className="shrink-0 rounded-full px-1.5 text-[10px]">{c.unreadCount}</Badge>}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
