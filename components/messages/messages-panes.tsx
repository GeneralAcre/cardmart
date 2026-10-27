"use client";

import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Messages as two panes on desktop: the conversation list on the left, the
 * open chat (or a "pick one" note) on the right. On phones only one shows at
 * a time: the list at /messages, the chat once one is opened.
 */
export function MessagesPanes({ list, children }: { list: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  const inChat = pathname !== "/messages";

  return (
    <div className="grid flex-1 gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <aside className={cn("flex min-w-0 flex-col gap-4", inChat && "hidden lg:flex")}>{list}</aside>
      <section className={cn("flex min-w-0 flex-col", !inChat && "hidden lg:flex")}>{children}</section>
    </div>
  );
}
