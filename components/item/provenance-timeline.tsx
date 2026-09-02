import { ExternalLink } from "lucide-react";
import type { ProvenanceType } from "@prisma/client";

import { PROVENANCE_LABELS } from "@/lib/labels";
import { formatDateTime, shortSignature } from "@/lib/format";

interface Entry {
  id: string;
  type: ProvenanceType;
  note: string;
  mockTxSignature: string;
  createdAt: string | Date;
  actor: { name: string | null } | null;
}

export function ProvenanceTimeline({ events }: { events: Entry[] }) {
  return (
    <ol className="flex flex-col gap-0">
      {events.map((event, i) => (
        <li key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
          {i !== events.length - 1 && (
            <span className="bg-border absolute top-3 left-[5px] h-full w-px" />
          )}
          <span className="bg-primary relative z-10 mt-1.5 size-2.5 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-0.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-sm font-medium">{PROVENANCE_LABELS[event.type]}</span>
              <span className="text-muted-foreground text-xs">{formatDateTime(event.createdAt)}</span>
            </div>
            <p className="text-muted-foreground text-sm">{event.note}</p>
            <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
              {event.actor && <span>{event.actor.name}</span>}
              <span className="inline-flex items-center gap-1 font-mono">
                <ExternalLink className="size-3" />
                {shortSignature(event.mockTxSignature)}
              </span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
