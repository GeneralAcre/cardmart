import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { getMyConversations } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { displayNameOf, UserAvatar } from "@/components/messages/user-avatar";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export default async function MessagesPage() {
  const user = await getCurrentUser();
  const conversations = await getMyConversations(user.id);

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <h1 className="mb-6 text-2xl font-semibold">Messages</h1>

      {conversations.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-24 text-center">
          <MessageCircle className="size-8" />
          <p className="text-sm">No conversations yet.</p>
          <p className="max-w-xs text-xs">
            Open a seller&apos;s profile or a listing and tap &quot;Message Seller&quot; to ask a question or
            negotiate a price.
          </p>
          <Link href="/marketplace" className="text-foreground text-sm underline">
            Browse the marketplace
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {conversations.map((c) => {
            const unread = c.unreadCount > 0;
            return (
              <Link
                key={c.id}
                href={`/messages/${c.id}`}
                className="bg-card hover:bg-muted/40 flex items-center gap-3 rounded-xl border p-3 transition-colors"
              >
                <UserAvatar user={c.otherUser} className="size-10" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={cn("truncate text-sm", unread ? "font-semibold" : "font-medium")}>
                      {displayNameOf(c.otherUser)}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs">{formatDateTime(c.lastMessageAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "truncate text-xs",
                        unread ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {c.lastMessage
                        ? `${c.lastMessage.senderId === user.id ? "You: " : ""}${c.lastMessage.body}`
                        : "No messages yet"}
                    </span>
                    {unread && <Badge className="shrink-0 rounded-full px-1.5 text-[10px]">{c.unreadCount}</Badge>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
