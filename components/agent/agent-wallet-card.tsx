"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpFromLine, Check, Copy, Droplets, Loader2, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { airdropToAgentWallet, withdrawFromAgentWallet } from "@/lib/agent-actions";
import { useWalletStore } from "@/lib/web3/wallet-store";
import { THB_PER_SOL } from "@/lib/pricing";
import { formatThb } from "@/lib/format";
import { useT } from "@/components/landing/language-provider";

/**
 * The agent's own wallet: what it can spend. Funding it is the user's real
 * spending cap — the agent can never pay more than what's in here.
 */
export function AgentWalletCard({ address, balanceSol }: { address: string; balanceSol: number | null }) {
  const router = useRouter();
  const { sendSol, connected } = useWalletStore();
  const [amount, setAmount] = useState("0.5");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<"fund" | "airdrop" | "withdraw" | null>(null);
  const [, startTransition] = useTransition();
  const t = useT();

  function run(kind: "fund" | "airdrop" | "withdraw", fn: () => Promise<void>) {
    setBusy(kind);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("Something went wrong. Try again."));
      } finally {
        setBusy(null);
      }
    });
  }

  function fund() {
    const sol = Number(amount);
    if (!(sol > 0)) return toast.error(t("Enter an amount of SOL."));
    run("fund", async () => {
      await sendSol(address, sol);
      toast.success(t("Sent {sol} SOL to your agent.", { sol }));
    });
  }

  function airdrop() {
    run("airdrop", async () => {
      const res = await airdropToAgentWallet();
      if (res.error) throw new Error(t(res.error));
      toast.success(t("1 test SOL is on its way to your agent."));
    });
  }

  function withdraw() {
    run("withdraw", async () => {
      const res = await withdrawFromAgentWallet();
      if (res.error) throw new Error(t(res.error));
      toast.success(t("Moved {sol} SOL back to your wallet.", { sol: res.sol?.toFixed(3) ?? "0" }));
    });
  }

  return (
    <section className="bg-card flex flex-col gap-4 rounded-xl border p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
            <Wallet className="size-3.5" /> {t("Agent wallet")}
          </span>
          <span className="text-2xl font-semibold tabular-nums">
            {balanceSol == null ? "—" : `${balanceSol.toFixed(3)} SOL`}
          </span>
          {balanceSol != null && (
            <span className="text-muted-foreground text-xs">≈ {formatThb(Math.floor(balanceSol * THB_PER_SOL))}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(address);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 font-mono text-xs"
          aria-label={t("Copy address")}
        >
          {address.slice(0, 4)}…{address.slice(-4)}
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
        </button>
      </div>

      <p className="text-muted-foreground text-xs">
        {t("Your agent can only spend what's in this wallet, so its balance is your hard limit. Unused SOL can be moved back any time.")}
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex flex-1 gap-2">
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-24 font-mono"
            aria-label={t("Amount in SOL")}
          />
          <Button className="flex-1" onClick={fund} disabled={!connected || busy !== null}>
            {busy === "fund" ? <Loader2 className="animate-spin" /> : <ArrowDownToLine />}
            {t("Fund from my wallet")}
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={airdrop} disabled={busy !== null} className="flex-1">
            {busy === "airdrop" ? <Loader2 className="animate-spin" /> : <Droplets />}
            {t("Test SOL")}
          </Button>
          <Button variant="ghost" onClick={withdraw} disabled={busy !== null || !balanceSol} className="flex-1">
            {busy === "withdraw" ? <Loader2 className="animate-spin" /> : <ArrowUpFromLine />}
            {t("Withdraw all")}
          </Button>
        </div>
      </div>
    </section>
  );
}
