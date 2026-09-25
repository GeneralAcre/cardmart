import {
  ArrowRightLeft,
  ExternalLink,
  Flame,
  KeyRound,
  Lock,
  PackageCheck,
  PackageOpen,
  Repeat,
  RotateCcw,
  ShieldCheck,
  ShieldX,
  Sparkles,
  Tag,
  TagX,
  Truck,
  Undo2,
  Vault,
  type LucideIcon,
} from "lucide-react";
import type { ProvenanceType } from "@prisma/client";

import { PROVENANCE_LABELS } from "@/lib/labels";
import { formatDateTime } from "@/lib/format";

const PROVENANCE_ICONS: Record<ProvenanceType, LucideIcon> = {
  MINTED_DIGITAL_TWIN: Sparkles,
  LISTED: Tag,
  DELISTED: TagX,
  ESCROW_LOCKED: Lock,
  SHIPPED_TO_WAREHOUSE: Truck,
  INSPECTION_PASSED: ShieldCheck,
  INSPECTION_REJECTED: ShieldX,
  DEPOSITED_TO_VAULT: Vault,
  DELIVERED_TO_BUYER: PackageCheck,
  OWNERSHIP_TRANSFERRED: ArrowRightLeft,
  RELISTED: RotateCcw,
  REDEEMED: PackageOpen,
  ESCROW_REFUNDED: Undo2,
  LISTING_APPROVED: KeyRound,
  TOKEN_BURNED: Flame,
  SWAPPED: Repeat,
};

interface Entry {
  id: string;
  type: ProvenanceType;
  note: string;
  createdAt: string | Date;
  actor: { name: string | null } | null;
  /** Only meaningful together with onChain — a real, working Solana Explorer link otherwise doesn't exist. */
  mockTxSignature: string;
  /** True when mockTxSignature is a real signed devnet transaction, not a simulated placeholder. */
  onChain: boolean;
}

function explorerTxUrl(signature: string) {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

export function ProvenanceTimeline({ events }: { events: Entry[] }) {
  return (
    <ol className="flex flex-col gap-0">
      {events.map((event, i) => {
        const Icon = PROVENANCE_ICONS[event.type];
        return (
          <li key={event.id} className="relative flex gap-4 pb-7 last:pb-0">
            {i !== events.length - 1 && (
              <span className="bg-border absolute top-10 bottom-0 left-5 w-px" />
            )}
            <div className="bg-muted text-foreground relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full">
              <Icon className="size-5" />
            </div>
            <div className="flex flex-1 flex-col gap-1 pt-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-base font-semibold">{PROVENANCE_LABELS[event.type]}</span>
                <span className="text-muted-foreground text-xs">{formatDateTime(event.createdAt)}</span>
              </div>
              <p className="text-muted-foreground text-sm">{event.note}</p>
              <div className="flex items-center gap-3">
                {event.actor && <span className="text-muted-foreground text-xs">{event.actor.name}</span>}
                {event.onChain && (
                  <a
                    href={explorerTxUrl(event.mockTxSignature)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs underline underline-offset-2"
                  >
                    View on Solana Explorer <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
