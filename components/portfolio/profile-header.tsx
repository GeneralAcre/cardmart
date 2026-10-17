"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { WalletActions } from "@/components/portfolio/wallet-actions";
import { ShippingInfoDialog } from "@/components/portfolio/shipping-info-dialog";
import { EditProfileDialog } from "@/components/portfolio/edit-profile-dialog";
import { PortfolioValueChart } from "@/components/portfolio/portfolio-value-chart";
import { useWalletStore } from "@/lib/web3/wallet-store";
import { formatDate, shortSignature } from "@/lib/format";
import { useT } from "@/components/landing/language-provider";

interface ProfileHeaderProps {
  name: string;
  handle: string | null;
  image: string | null;
  walletAddress: string | null;
  createdAt: Date;
  /** Real devnet SOL balance, or null if there's no wallet / the RPC call failed. */
  solBalance: number | null;
  portfolioValueHistory: { totalThb: number; createdAt: string }[];
  shippingAddress: string | null;
  phone: string | null;
}

export function ProfileHeader({
  name,
  handle,
  image,
  walletAddress,
  createdAt,
  solBalance,
  portfolioValueHistory,
  shippingAddress,
  phone,
}: ProfileHeaderProps) {
  const { connected } = useWalletStore();
  const [copied, setCopied] = useState(false);
  const t = useT();
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function copyWallet() {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress);
    toast.success(t("Wallet address copied"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // Sits straight on the page (no card frame): who you are, your balance
  // with its actions, then how your portfolio's value has moved.
  return (
    <div className="flex flex-col gap-6">
      {/* You on the left; your balance and its actions together on the right. */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar className="ring-border size-16 shrink-0 ring-2 ring-offset-2 ring-offset-background">
            {image && <AvatarImage src={image} alt={name} />}
            <AvatarFallback className="text-lg font-medium">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate text-xl font-semibold sm:text-2xl">{name}</span>
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-sm">
              {handle && <span>@{handle}</span>}
              <EditProfileDialog name={name} handle={handle} />
            </div>
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {walletAddress ? (
                <button
                  type="button"
                  onClick={copyWallet}
                  className="hover:text-foreground flex items-center gap-1.5 font-mono transition-colors"
                >
                  {shortSignature(walletAddress)}
                  {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                </button>
              ) : (
                <span>{t("No wallet connected")}</span>
              )}
              <span className="text-border">&middot;</span>
              <span>{t("Member since {date}", { date: formatDate(createdAt) })}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:items-end">
          <Stat label={t("SOL Balance")} value={solBalance != null ? `${solBalance.toFixed(4)} SOL` : "—"} />
          {/* Phones: the buttons share the width equally on one row; from sm up they sit right-aligned. */}
          <div className="flex gap-2 sm:justify-end [&_button]:flex-1 sm:[&_button]:flex-none">
            {connected && <WalletActions solBalance={solBalance} />}
            <ShippingInfoDialog shippingAddress={shippingAddress} phone={phone} />
          </div>
        </div>
      </div>

      <PortfolioValueChart initialHistory={portfolioValueHistory} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 sm:items-end">
      <span className="eyebrow text-muted-foreground">{label}</span>
      <span className="text-3xl leading-none font-bold tracking-tight tabular-nums">{value}</span>
    </div>
  );
}
