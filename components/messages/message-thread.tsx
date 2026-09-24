"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { markConversationRead, sendMessage } from "@/lib/actions";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface ThreadMessage {
  id: string;
  body: string;
  senderId: string;
  createdAt: string;
}

// No websocket infra in this project, so new replies arrive by re-fetching
// the server component every few seconds while the tab is visible — cheap,
// and plenty for a two-person chat.
const POLL_INTERVAL_MS = 5000;

export function MessageThread({
  conversationId,
  currentUserId,
  messages,
}: {
  conversationId: string;
  currentUserId: string;
  messages: ThreadMessage[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  const lastIncomingId = [...messages].reverse().find((m) => m.senderId !== currentUserId)?.id;

  // Mark read on open and whenever a new incoming message lands, then
  // refresh so the header's unread badge drops too.
  useEffect(() => {
    if (!lastIncomingId) return;
    void markConversationRead(conversationId).then(() => router.refresh());
  }, [conversationId, lastIncomingId, router]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  function submit() {
    const body = draft.trim();
    if (!body) return;
    startTransition(async () => {
      try {
        await sendMessage(conversationId, body);
        setDraft("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not send message.");
      }
    });
  }

  return (
    <div className="bg-card flex min-h-[60vh] flex-1 flex-col rounded-xl border">
      <div className="flex max-h-[65vh] flex-1 flex-col gap-2 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-muted-foreground m-auto text-center text-sm">
            Say hello — ask about the item&apos;s condition, shipping, or whether they&apos;d take a lower price.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === currentUserId;
            return (
              <div key={m.id} className={cn("flex flex-col gap-0.5", mine ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    "max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm",
                    mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm",
                  )}
                >
                  {m.body}
                </div>
                <span className="text-muted-foreground px-1 text-[10px]">{formatDateTime(m.createdAt)}</span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="flex items-end gap-2 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter adds a new line.
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Write a message…"
          rows={1}
          maxLength={2000}
          className="max-h-32 min-h-10 resize-none"
          disabled={pending}
        />
        <Button type="submit" size="icon" disabled={pending || !draft.trim()} aria-label="Send">
          {pending ? <Loader2 className="animate-spin" /> : <Send />}
        </Button>
      </form>
    </div>
  );
}
