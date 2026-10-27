import { getMyConversations } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { ConversationList } from "@/components/messages/conversation-list";
import { MessagesPanes } from "@/components/messages/messages-panes";

// The conversation list stays on the left while a chat opens on the right, so
// it's loaded here once for /messages and every /messages/[id].
export default async function MessagesLayout({ children }: { children: React.ReactNode }) {
  const [user, t] = await Promise.all([getCurrentUser(), getT()]);
  const conversations = await getMyConversations(user.id);

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
      <MessagesPanes
        list={
          <>
            <h1 className="text-2xl font-semibold">{t("Messages")}</h1>
            <ConversationList
              conversations={conversations.map((c) => ({
                id: c.id,
                otherUser: c.otherUser,
                lastMessageAt: c.lastMessageAt.toISOString(),
                unreadCount: c.unreadCount,
                preview: c.lastMessage
                  ? `${c.lastMessage.senderId === user.id ? `${t("You:")} ` : ""}${
                      c.lastMessage.body || (c.lastMessage.imageUrls.length ? t("Sent a photo") : t("Shared a card"))
                    }`
                  : null,
              }))}
            />
          </>
        }
      >
        {children}
      </MessagesPanes>
    </div>
  );
}
