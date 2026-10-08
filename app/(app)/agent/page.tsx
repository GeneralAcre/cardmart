import { Bot, Check, ChevronDown, CircleAlert, ShieldCheck, X } from "lucide-react";
import Link from "next/link";

import { AgentWalletCard } from "@/components/agent/agent-wallet-card";
import { AgentChat } from "@/components/agent/agent-chat";
import { NewTaskForm } from "@/components/agent/new-task-form";
import { AgentActivity, AgentDeals, AgentTaskList } from "@/components/agent/agent-tasks";
import { getAgentDashboard, getMyWantedCards } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { displayImage } from "@/lib/card-image";
import { isAgentAiConfigured } from "@/lib/agent/ai";
import { getAgentBalanceLamports, getOrCreateAgentWallet, lamportsToSol } from "@/lib/agent/wallet";
import { getTaskReports } from "@/lib/agent/report";
import { formatThb } from "@/lib/format";

// A scan can wait on the AI for a while; give the Server Actions on this page room.
export const maxDuration = 60;

// Keep in step with lib/agent/engine.ts (filters, scans) and lib/actions.ts (buying).
const CAN_DO = [
  "Finds Pokémon and One Piece cards, raw or graded",
  "Checks every new listing, day and night",
  "Skips look-alikes from other sets",
  "Compares prices with recent sales and eBay",
  "Asks you first, or buys on its own",
  "Pays through escrow, like any purchase",
];
const WONT_DO = [
  "Never pays over your max price",
  "Never spends more than its wallet holds",
  "No auctions, offers or trades",
  "Never sells your cards",
  "Up to 5 tasks at once",
];

// ?alert=<wanted card id> starts the chat (or form) from that card alert (Portfolio → Alerts).
export default async function AgentPage({ searchParams }: { searchParams: Promise<{ alert?: string }> }) {
  const [user, t, { alert }] = await Promise.all([getCurrentUser(), getT(), searchParams]);
  const [wallet, dashboard, alerts] = await Promise.all([
    getOrCreateAgentWallet(user.id),
    getAgentDashboard(user.id),
    getMyWantedCards(user.id),
  ]);
  const balanceSol = wallet
    ? await getAgentBalanceLamports(wallet.address).then(lamportsToSol, () => null)
    : null;
  const aiReady = isAgentAiConfigured();
  const presets = alerts.map((a) => ({
    id: a.id,
    query: a.query,
    gradingCompany: a.gradingCompany,
    minGrade: a.minGrade,
    blackLabelOnly: a.blackLabelOnly,
    maxPriceThb: a.maxPriceThb,
    trustedOnly: a.trustedOnly,
  }));
  const waiting = dashboard.decisions.filter((d) => d.status === "PROPOSED").length;
  const decisions = dashboard.decisions.map((d) => ({
    id: d.id,
    status: d.status,
    priceThb: d.priceThb,
    offerThb: d.offerThb,
    fairValueThb: d.fairValueThb,
    confidence: d.confidence,
    reasoning: d.reasoning,
    error: d.error,
    createdAt: d.createdAt.toISOString(),
    taskSummary: d.mandate.summary,
    asset: {
      id: d.asset.id,
      name: d.asset.name,
      gradingCompany: d.asset.gradingCompany,
      grade: d.asset.grade,
      isBlackLabel: d.asset.isBlackLabel,
      imageUrl: displayImage(d.asset)?.url ?? null,
    },
  }));
  const reports = await getTaskReports(dashboard.mandates.map((m) => m.id));
  const totals = [...reports.values()].reduce(
    (sum, r) => ({ reviewed: sum.reviewed + r.reviewed, bought: sum.bought + r.bought, savedThb: sum.savedThb + r.savedThb }),
    { reviewed: 0, bought: 0, savedThb: 0 },
  );
  const stats = [
    { label: t("Tasks watching"), value: String(dashboard.mandates.filter((m) => m.status === "ACTIVE").length) },
    { label: t("Listings reviewed"), value: totals.reviewed.toLocaleString() },
    { label: t("Cards bought"), value: String(totals.bought) },
    { label: t("Saved vs fair value"), value: formatThb(totals.savedThb), accent: totals.savedThb > 0 },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      {/* Wallet sits beside the intro, not at the bottom: funding it is the first thing a new user has to do. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <header className="relative overflow-hidden rounded-2xl border bg-[radial-gradient(120%_140%_at_0%_0%,rgba(0,199,88,0.14),transparent_55%)] p-5 sm:p-8">
          <div className="flex flex-col gap-6">
            <div className="flex max-w-xl flex-col gap-3">
              <span className="bg-background/60 text-muted-foreground flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs backdrop-blur">
                <Bot className="size-3.5" /> {t("Buying agent")}
              </span>
              <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                {t("Your card hunter that never sleeps.")}
              </h1>
              <p className="text-muted-foreground">
                {t("Chat with it like a shop assistant: name a card and your max price, and it watches every listing and buys the right one for you.")}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label} className="bg-background/60 flex flex-col gap-0.5 rounded-xl border px-3 py-2.5 backdrop-blur">
                  <dt className="text-muted-foreground text-[11px]">{s.label}</dt>
                  <dd className={s.accent ? "text-success text-lg font-semibold tabular-nums" : "text-lg font-semibold tabular-nums"}>
                    {s.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <details className="group mt-5 w-fit text-sm">
            <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden">
              <ShieldCheck className="size-4" /> {t("What it can and can't do")}
              <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-3 grid grid-cols-1 gap-x-10 gap-y-1.5 rounded-xl border p-4 sm:grid-cols-2">
              <ul className="flex flex-col gap-1.5">
                {CAN_DO.map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <Check className="text-success mt-0.5 size-4 shrink-0" /> {t(line)}
                  </li>
                ))}
              </ul>
              <ul className="flex flex-col gap-1.5">
                {WONT_DO.map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <X className="text-muted-foreground mt-0.5 size-4 shrink-0" /> {t(line)}
                  </li>
                ))}
              </ul>
            </div>
          </details>
        </header>

        {wallet ? (
          <AgentWalletCard address={wallet.address} balanceSol={balanceSol} />
        ) : (
          <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-xs">
            {t("Agent wallets aren't configured on this server, so purchases run in simulated mode.")}
          </p>
        )}
      </div>

      {!aiReady && (
        <p className="bg-muted/40 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm">
          <CircleAlert className="text-muted-foreground size-4 shrink-0" />
          {t("The AI isn't connected yet — you can fund the wallet, but tasks won't run.")}
        </p>
      )}

      {waiting > 0 && (
        <Link
          href="#waiting"
          className="bg-highlight text-highlight-foreground rounded-xl px-4 py-3 text-sm font-medium hover:opacity-90"
        >
          {t("Your agent found {count} card(s) waiting for your OK — see below.", { count: waiting })}
        </Link>
      )}

      <AgentDeals decisions={decisions} />

      {aiReady ? (
        <AgentChat key={alert} startFrom={alert} alerts={presets} />
      ) : (
        <NewTaskForm key={alert} startFrom={alert} alerts={presets} />
      )}

      <AgentTaskList
        tasks={dashboard.mandates.map((m) => ({
          id: m.id,
          summary: m.summary,
          status: m.status,
          maxPriceThb: m.maxPriceThb,
          budgetThb: m.budgetThb,
          spentThb: m.spentThb,
          maxCards: m.maxCards,
          boughtCount: m.boughtCount,
          autoBuy: m.autoBuy,
          trustedSellersOnly: m.trustedSellersOnly,
          lastScannedAt: m.lastScannedAt?.toISOString() ?? null,
          decisionCount: m._count.decisions,
          report: reports.get(m.id)!,
        }))}
      />

      <AgentActivity decisions={decisions} />
    </div>
  );
}
