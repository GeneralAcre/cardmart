"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { formatDate, formatThb, shortSignature } from "@/lib/format";

interface ProfileHeaderProps {
  name: string;
  handle: string | null;
  image: string | null;
  walletMock: string | null;
  createdAt: Date;
  stats: {
    totalCards: number;
    inHand: number;
    inVault: number;
    listedValueThb: number;
  };
}

export function ProfileHeader({ name, handle, image, walletMock, createdAt, stats }: ProfileHeaderProps) {
  const [copied, setCopied] = useState(false);
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function copyWallet() {
    if (!walletMock) return;
    navigator.clipboard.writeText(walletMock);
    toast.success("Wallet address copied");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="bg-card flex flex-col gap-5 rounded-xl border p-5 sm:flex-row sm:items-center sm:gap-6">
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
            {walletMock ? (
              <button
                type="button"
                onClick={copyWallet}
                className="hover:text-foreground flex items-center gap-1.5 font-mono transition-colors"
              >
                {shortSignature(walletMock)}
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

      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4 sm:gap-x-8">
        <Stat label="Total Cards" value={String(stats.totalCards)} />
        <Stat label="Listed Value" value={formatThb(stats.listedValueThb)} />
        <Stat label="In Hand" value={String(stats.inHand)} />
        <Stat label="In Vault" value={String(stats.inVault)} />
      </div>
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
