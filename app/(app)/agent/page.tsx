import { Bot, CircleAlert, ShieldCheck } from "lucide-react";

import { AgentWalletCard } from "@/components/agent/agent-wallet-card";
import { NewTaskForm } from "@/components/agent/new-task-form";
import { AgentActivity, AgentTaskList } from "@/components/agent/agent-tasks";
import { getAgentDashboard } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { displayImage } from "@/lib/card-image";
import { isAgentAiConfigured } from "@/lib/agent/ai";
import { getAgentBalanceLamports, getOrCreateAgentWallet, lamportsToSol } from "@/lib/agent/wallet";

// A scan can wait on Claude for a while; give the Server Actions on this page room.
export const maxDuration = 60;

export default async function AgentPage() {
  const [user, t] = await Promise.all([getCurrentUser(), getT()]);
  const [wallet, dashboard] = await Promise.all([getOrCreateAgentWallet(user.id), getAgentDashboard(user.id)]);
  const balanceSol = wallet
    ? await getAgentBalanceLamports(wallet.address).then(lamportsToSol, () => null)
    : null;
  const aiReady = isAgentAiConfigured();
  const waiting = dashboard.decisions.filter((d) => d.status === "PROPOSED").length;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex max-w-3xl flex-col gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Bot className="size-6" /> {t("Buying agent")}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t("Tell it what you're hunting for. It checks every new listing, judges whether it's the right card at a fair price, and buys it from its own wallet — within limits you set.")}
        </p>
        <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
          <ShieldCheck className="mt-px size-3.5 shrink-0" />
          {t("Your limits are enforced in code and by the wallet balance, never left to the AI. Every purchase still goes through escrow and warehouse inspection.")}
        </p>
      </header>

      {!aiReady && (
        <div className="bg-muted/40 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm">
          <CircleAlert className="text-muted-foreground mt-0.5 size-4 shrink-0" />
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">{t("The buying agent isn't switched on for this site yet.")}</span>
            <span className="text-muted-foreground text-xs">
              {t("You can already fund your agent wallet. Planning and buying start once the AI is connected.")}
            </span>
          </div>
        </div>
      )}

      {waiting > 0 && (
        <p className="bg-highlight text-highlight-foreground rounded-xl px-4 py-3 text-sm font-medium">
          {t("Your agent found {count} card(s) waiting for your OK — see below.", { count: waiting })}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_22rem]">
        <NewTaskForm />
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
