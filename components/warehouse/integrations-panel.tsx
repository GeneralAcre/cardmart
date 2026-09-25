"use client";

import { useState, useTransition } from "react";
import { CircleAlert, CircleCheck, CircleDashed, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { runIntegrationCheck } from "@/lib/actions";
import type { IntegrationStatus } from "@/lib/integrations";
import { formatDateTime } from "@/lib/format";

const STATE_ICON = { ok: CircleCheck, not_configured: CircleDashed, error: CircleAlert } as const;
const STATE_CLASS = { ok: "text-success", not_configured: "text-muted-foreground", error: "text-destructive" } as const;

// Runs on demand, not on page load — PSA's free tier allows only 100 calls a
// day, and every check spends one.
export function IntegrationsPanel() {
  const [results, setResults] = useState<IntegrationStatus[] | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      setResults(await runIntegrationCheck());
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground max-w-xl text-sm">
          Calls PSA, eBay and the TCG API live with the keys this deployment has, and shows exactly what each one
          answered.
        </p>
        <Button onClick={run} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          Run check
        </Button>
      </div>
      {results && (
        <div className="bg-card divide-y rounded-xl border">
          {results.map((r) => {
            const Icon = STATE_ICON[r.state];
            return (
              <div key={r.name} className="flex gap-3 p-4">
                <Icon className={`mt-0.5 size-5 shrink-0 ${STATE_CLASS[r.state]}`} />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-semibold">{r.name}</span>
                  <span className="text-muted-foreground text-sm break-words">{r.message}</span>
                </div>
              </div>
            );
          })}
          <p className="text-muted-foreground px-4 py-2 text-[11px]">Checked {formatDateTime(results[0].checkedAt)}</p>
        </div>
      )}
    </div>
  );
}
