import { ExternalLink } from "lucide-react";
import type { ProvenanceType } from "@prisma/client";

import { PROVENANCE_LABELS } from "@/lib/labels";
import { formatDate, formatThb, shortSignature } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

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

// Events whose note states the price ("Listed for sale at 72,000 THB.",
// "Buyer payment of 310,000 THB locked in escrow."). Other notes can mention
// amounts that aren't a price (a mint fee), so they're never parsed.
const PRICED_TYPES = new Set<ProvenanceType>(["LISTED", "RELISTED", "ESCROW_LOCKED"]);
// Events that change who owns the card, set in bold.
const KEY_TYPES = new Set<ProvenanceType>(["OWNERSHIP_TRANSFERRED", "SWAPPED", "REDEEMED"]);

function notePrice(note: string): number | null {
  const match = note.match(/([\d,]+)\s*THB/);
  return match ? Number(match[1].replace(/,/g, "")) : null;
}

function explorerTxUrl(signature: string) {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

/**
 * The card's history as a table, newest first: what happened, at what
 * price, by whom, its on-chain transaction and when. A sale takes its price
 * from the payment held just before it. The full note is on hover.
 */
export async function ProvenanceTimeline({ events }: { events: Entry[] }) {
  const t = await getT();

  // Walk oldest → newest so each sale can pick up the payment before it.
  const oldestFirst = [...events].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const rows: (Entry & { price: number | null; label: string })[] = [];
  let lastPayment: number | null = null;
  for (const event of oldestFirst) {
    const parsed = PRICED_TYPES.has(event.type) ? notePrice(event.note) : null;
    if (event.type === "ESCROW_LOCKED") lastPayment = parsed;
    const price = event.type === "OWNERSHIP_TRANSFERRED" ? lastPayment : parsed;
    if (event.type === "OWNERSHIP_TRANSFERRED" || event.type === "ESCROW_REFUNDED") lastPayment = null;
    const label =
      event.type === "OWNERSHIP_TRANSFERRED"
        ? t("Sale")
        : event.type === "LISTED" && event.note.startsWith("Price updated")
          ? t("Repriced")
          : t(PROVENANCE_LABELS[event.type]);
    rows.unshift({ ...event, price, label });
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("Item History")}</h2>
        <span className="text-muted-foreground text-sm">
          {t(rows.length === 1 ? "{count} event" : "{count} events", { count: rows.length })}
        </span>
      </div>

      <div className="bg-card max-h-[29rem] overflow-y-auto rounded-2xl border">
        <table className="w-full text-sm">
          <thead className="bg-card sticky top-0 z-10">
            <tr className="text-muted-foreground border-b text-left text-[11px] font-semibold tracking-wider uppercase">
              <th className="px-4 py-3 font-semibold">{t("Event")}</th>
              <th className="px-4 py-3 font-semibold">{t("Price")}</th>
              <th className="hidden px-4 py-3 font-semibold md:table-cell">{t("By")}</th>
              <th className="hidden px-4 py-3 font-semibold sm:table-cell">{t("Tx")}</th>
              <th className="px-4 py-3 text-right font-semibold">{t("Date")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.id} title={row.note} className="hover:bg-muted/40 transition-colors">
                <td className={cn("px-4 py-3", KEY_TYPES.has(row.type) ? "text-foreground font-semibold" : "text-muted-foreground font-medium")}>
                  {row.label}
                </td>
                <td className="px-4 py-3 tabular-nums">{row.price != null ? formatThb(row.price) : ""}</td>
                <td className="text-muted-foreground hidden truncate px-4 py-3 md:table-cell">{row.actor?.name ?? ""}</td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  {row.onChain && (
                    <a
                      href={explorerTxUrl(row.mockTxSignature)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-mono text-xs hover:underline"
                    >
                      {shortSignature(row.mockTxSignature)} <ExternalLink className="size-3" />
                    </a>
                  )}
                </td>
                <td className="text-muted-foreground px-4 py-3 text-right whitespace-nowrap">{formatDate(row.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
