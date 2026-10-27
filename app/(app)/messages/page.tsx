import { MessageCircle } from "lucide-react";

import { getT } from "@/lib/i18n/server";

// The right pane before a chat is picked (desktop only; on phones the list
// from the layout is the whole page). The list itself lives in layout.tsx.
export default async function MessagesPage() {
  const t = await getT();
  return (
    <div className="text-muted-foreground flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed text-center">
      <MessageCircle className="size-8" />
      <p className="text-sm">{t("Select a conversation to read and reply.")}</p>
    </div>
  );
}
