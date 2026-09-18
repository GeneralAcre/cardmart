"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { WalletActions } from "@/components/portfolio/wallet-actions";
import { ListedValueChart, type ListedAssetPoint } from "@/components/portfolio/listed-value-chart";
import { PortfolioValueChart } from "@/components/portfolio/portfolio-value-chart";
import { useWalletStore } from "@/lib/web3/wallet-store";
import { formatDate, shortSignature } from "@/lib/format";

interface ProfileHeaderProps {
  name: string;
  handle: string | null;
  image: string | null;
  walletAddress: string | null;
  createdAt: Date;
  listedValueThb: number;
  listedAssets: ListedAssetPoint[];
  /** Real devnet SOL balance, or null if there's no wallet / the RPC call failed. */
  solBalance: number | null;
  portfolioValueHistory: { totalThb: number; createdAt: string }[];
}

export function ProfileHeader({
  name,
  handle,
  image,
  walletAddress,
  createdAt,
  listedValueThb,
  listedAssets,
  solBalance,
  portfolioValueHistory,
}: ProfileHeaderProps) {
  const { connected } = useWalletStore();
  const [copied, setCopied] = useState(false);
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function copyWallet() {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress);
    toast.success("Wallet address copied");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="bg-card flex flex-col gap-4 rounded-xl border p-5">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Avatar className="ring-border size-14 shrink-0 ring-2 ring-offset-2">
            {image && <AvatarImage src={image} alt={name} />}
            <AvatarFallback className="text-base font-medium">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="truncate text-lg font-semibold">{name}</span>
              {handle && <span className="text-muted-foreground text-sm">@{handle}</span>}
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
                <span>No wallet connected</span>
              )}
              <span className="text-border">&middot;</span>
              <span>Member since {formatDate(createdAt)}</span>
            </div>
          </div>
        </div>

        <Separator className="hidden sm:block" orientation="vertical" />

        <Stat label="SOL Balance" value={solBalance != null ? `${solBalance.toFixed(4)} SOL` : "—"} />
      </div>

      <div className="border-t pt-4">
        <ListedValueChart assets={listedAssets} totalThb={listedValueThb} />
      </div>

      <div className="border-t pt-4">
        <PortfolioValueChart initialHistory={portfolioValueHistory} />
      </div>

      {connected && (
        <div className="border-t pt-4">
          <WalletActions solBalance={solBalance} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-lg leading-none font-semibold tracking-tight tabular-nums sm:text-xl">
        {value}
      </span>
      <span className="text-muted-foreground text-xs whitespace-nowrap">{label}</span>
    </div>
  );
}
