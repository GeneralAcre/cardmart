import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getConversation } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { MessageThread } from "@/components/messages/message-thread";
import { displayNameOf, UserAvatar } from "@/components/messages/user-avatar";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const conversation = await getConversation(id, user.id);
  if (!conversation) notFound();

  const { otherUser } = conversation;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center gap-3">
        <Link href="/messages" className="text-muted-foreground hover:text-foreground" aria-label="Back to messages">
          <ArrowLeft className="size-5" />
        </Link>
        <Link href={`/store/${otherUser.id}`} className="flex min-w-0 items-center gap-3 hover:underline">
          <UserAvatar user={otherUser} className="size-9" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold">{displayNameOf(otherUser)}</span>
            {otherUser.handle && <span className="text-muted-foreground text-xs">@{otherUser.handle}</span>}
          </div>
        </Link>
      </div>

      <MessageThread
        conversationId={conversation.id}
        currentUserId={user.id}
        messages={conversation.messages.map((m) => ({
          id: m.id,
          body: m.body,
          senderId: m.senderId,
          createdAt: m.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
