"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, LifeBuoy, Mail, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { setContactMessageHandled } from "@/lib/contact-actions";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useT } from "@/components/landing/language-provider";

export interface SupportMessageRow {
  id: string;
  name: string;
  email: string;
  message: string;
  createdAt: string;
  handledAt: string | null;
}

function MessageCard({ m }: { m: SupportMessageRow }) {
  const [pending, startTransition] = useTransition();
  const t = useT();
  const handled = Boolean(m.handledAt);

  function toggle() {
    startTransition(async () => {
      try {
        await setContactMessageHandled(m.id, !handled);
        toast.success(handled ? t("Moved back to the inbox.") : t("Marked as handled."));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("Could not update this message."));
      }
    });
  }

  const replyHref = `mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent("Re: your message to CardMart")}`;

  return (
    <article className={cn("bg-card flex flex-col gap-3 rounded-xl border p-4", handled && "opacity-60")}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold">{m.name}</span>
          <span className="text-muted-foreground truncate text-xs">{m.email}</span>
        </div>
        <span className="text-muted-foreground text-xs">{formatDateTime(m.createdAt)}</span>
      </header>
      <p className="text-sm break-words whitespace-pre-line">{m.message}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" asChild>
          <a href={replyHref}>
            <Mail /> {t("Reply by email")}
          </a>
        </Button>
        <Button size="sm" variant={handled ? "ghost" : "default"} disabled={pending} onClick={toggle}>
          {handled ? <RotateCcw /> : <CheckCircle2 />}
          {handled ? t("Reopen") : t("Mark handled")}
        </Button>
      </div>
    </article>
  );
}

export function SupportInbox({ open, handled }: { open: SupportMessageRow[]; handled: SupportMessageRow[] }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-8">
      {open.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-20 text-center">
          <LifeBuoy className="size-8" />
          <p className="text-sm">{t("Inbox zero. Messages from the site's contact form land here.")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {open.map((m) => (
            <MessageCard key={m.id} m={m} />
          ))}
        </div>
      )}
      {handled.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">{t("Handled")}</h2>
          {handled.map((m) => (
            <MessageCard key={m.id} m={m} />
          ))}
        </section>
      )}
    </div>
  );
}
