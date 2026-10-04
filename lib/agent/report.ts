import "server-only";
// A buying task's results in numbers: what the agent reviewed, how much of it
// was the right card, what it bought and how good the best find was. Shown on
// /agent under each task, and sent as a wrap-up notification when a task ends.
import { prisma } from "@/lib/prisma";

export interface TaskReport {
  reviewed: number;
  // Listings the AI called the right card at a fair price (proposed, offered, bought or declined by you).
  matched: number;
  bought: number;
  offers: number;
  waiting: number;
  // Fair value minus what was paid, summed over cards bought below fair value.
  savedThb: number;
  best: { name: string; priceThb: number; fairValueThb: number; pctUnder: number } | null;
}

const EMPTY: TaskReport = { reviewed: 0, matched: 0, bought: 0, offers: 0, waiting: 0, savedThb: 0, best: null };

export async function getTaskReports(mandateIds: string[]): Promise<Map<string, TaskReport>> {
  const reports = new Map(mandateIds.map((id) => [id, { ...EMPTY }]));
  if (mandateIds.length === 0) return reports;
  const decisions = await prisma.agentDecision.findMany({
    where: { mandateId: { in: mandateIds } },
    select: {
      mandateId: true,
      status: true,
      priceThb: true,
      offerThb: true,
      fairValueThb: true,
      asset: { select: { name: true } },
    },
  });
  for (const d of decisions) {
    const r = reports.get(d.mandateId)!;
    r.reviewed++;
    if (d.status === "SKIPPED") continue;
    r.matched++;
    if (d.status === "EXECUTED") r.bought++;
    if (d.status === "OFFERED") r.offers++;
    if (d.status === "PROPOSED") r.waiting++;
    const paid = d.offerThb ?? d.priceThb;
    if (d.fairValueThb == null || d.fairValueThb <= 0) continue;
    if (d.status === "EXECUTED") r.savedThb += Math.max(0, d.fairValueThb - paid);
    const pctUnder = Math.round(((d.fairValueThb - paid) / d.fairValueThb) * 100);
    if (!r.best || pctUnder > r.best.pctUnder) {
      r.best = { name: d.asset.name, priceThb: paid, fairValueThb: d.fairValueThb, pctUnder };
    }
  }
  return reports;
}

const thb = (n: number) => `${n.toLocaleString()} THB`;

/** The report as a few plain sentences, for the wrap-up notification. */
export function reportText(r: TaskReport, task: { spentThb: number; budgetThb: number }): string {
  if (r.reviewed === 0) return "It didn't find any listing that fit this task.";
  const lines = [
    `Reviewed ${r.reviewed} listing${r.reviewed === 1 ? "" : "s"}; ${r.matched} ${r.matched === 1 ? "was" : "were"} the right card at a fair price.`,
  ];
  if (r.bought > 0) lines.push(`Bought ${r.bought} for ${thb(task.spentThb)} of the ${thb(task.budgetThb)} budget.`);
  if (r.savedThb > 0) lines.push(`That's ${thb(r.savedThb)} under fair value.`);
  if (r.best && r.best.pctUnder > 0) {
    lines.push(`Best find: ${r.best.name} at ${thb(r.best.priceThb)}, ${r.best.pctUnder}% under fair value.`);
  }
  return lines.join(" ");
}

/** The wrap-up text for one task, e.g. when it finishes. */
export async function taskReportText(mandateId: string): Promise<string> {
  const mandate = await prisma.agentMandate.findUnique({
    where: { id: mandateId },
    select: { spentThb: true, budgetThb: true },
  });
  if (!mandate) return "";
  const report = (await getTaskReports([mandateId])).get(mandateId)!;
  return reportText(report, mandate);
}
