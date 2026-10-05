"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createAgentTask } from "@/lib/agent-actions";
import { scanAgentMandate } from "@/lib/actions";
import { draftProblem, draftToTaskInput, type TaskDraft } from "@/lib/agent/task";
import { useT } from "@/components/landing/language-provider";

/**
 * Starts a task from a draft, then runs its first scan of what's listed now.
 * `onDone` gets a line about how the first scan went (already translated),
 * or isn't called if the task didn't start.
 */
export function useStartTask(onDone: (outcome: string) => void) {
  const router = useRouter();
  const t = useT();
  const [starting, startTransition] = useTransition();

  function start(draft: TaskDraft) {
    if (draftProblem(draft)) return;
    startTransition(async () => {
      const res = await createAgentTask(draftToTaskInput(draft));
      if (res.error || !res.id) {
        toast.error(t(res.error ?? "Couldn't start the agent."));
        return;
      }
      toast.success(t("Agent started. It's checking what's listed now…"));
      router.refresh();
      const scan = await scanAgentMandate(res.id);
      const outcome = scan.error
        ? t(scan.error)
        : scan.recorded === 0
          ? t("Nothing matching is listed right now. Your agent will check every new listing.")
          : t("Your agent looked at {count} listing(s). See its picks below.", { count: scan.recorded });
      if (scan.error) toast.error(outcome);
      onDone(outcome);
      router.refresh();
    });
  }

  return { start, starting };
}
