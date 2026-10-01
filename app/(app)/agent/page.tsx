import { Bot, Check, ChevronDown, CircleAlert, ShieldCheck, X } from "lucide-react";

import { AgentWalletCard } from "@/components/agent/agent-wallet-card";
import { NewTaskForm } from "@/components/agent/new-task-form";
import { AgentActivity, AgentTaskList } from "@/components/agent/agent-tasks";
import { getAgentDashboard, getMyWantedCards } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { displayImage } from "@/lib/card-image";
import { isAgentAiConfigured } from "@/lib/agent/ai";
import { getAgentBalanceLamports, getOrCreateAgentWallet, lamportsToSol } from "@/lib/agent/wallet";

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

// ?alert=<wanted card id> starts the form from that card alert (Portfolio → Alerts).
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
  const waiting = dashboard.decisions.filter((d) => d.status === "PROPOSED").length;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Bot className="size-6" /> {t("Buying agent")}
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          {t("Name a card and your max price. The agent watches every listing and buys the right one for you.")}
        </p>
        <details className="group w-fit text-sm">
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

      {!aiReady && (
        <p className="bg-muted/40 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm">
          <CircleAlert className="text-muted-foreground size-4 shrink-0" />
          {t("The AI isn't connected yet — you can fund the wallet, but tasks won't run.")}
        </p>
      )}

      {waiting > 0 && (
        <p className="bg-highlight text-highlight-foreground rounded-xl px-4 py-3 text-sm font-medium">
          {t("Your agent found {count} card(s) waiting for your OK — see below.", { count: waiting })}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_20rem] lg:items-start">
        <NewTaskForm
          key={alert}
          startFrom={alert}
          alerts={alerts.map((a) => ({
            id: a.id,
            query: a.query,
            gradingCompany: a.gradingCompany,
            minGrade: a.minGrade,
            blackLabelOnly: a.blackLabelOnly,
            maxPriceThb: a.maxPriceThb,
            trustedOnly: a.trustedOnly,
          }))}
        />
        {wallet ? (
          <AgentWalletCard address={wallet.address} balanceSol={balanceSol} />
        ) : (
          <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-xs">
            {t("Agent wallets aren't configured on this server, so purchases run in simulated mode.")}
          </p>
        )}
      </div>

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
        }))}
      />

      <AgentActivity
        decisions={dashboard.decisions.map((d) => ({
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
        }))}
      />
    </div>
  );
}
