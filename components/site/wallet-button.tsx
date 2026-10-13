"use client";

import { Wallet, Copy, Check } from "lucide-react";
import { useState } from "react";
import { useWalletStore } from "@/lib/web3/wallet-store";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useT } from "@/components/landing/language-provider";

function truncateKey(key: string) {
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

/**
 * The wallet part of the profile menu: the address to fund, with a copy
 * button, or a Connect Wallet item when there's no wallet yet. Lives in the
 * profile menu rather than its own header button, to keep the header short.
 */
export function WalletMenuSection() {
  const [copied, setCopied] = useState(false);
  const { connected, connecting, publicKey, connect } = useWalletStore();
  const t = useT();

  function copyAddress() {
    if (!publicKey) return;
    navigator.clipboard.writeText(publicKey);
    toast.success(t("Address copied — safe to send test SOL here"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!connected) {
    return (
      <DropdownMenuItem
        disabled={connecting}
        onSelect={async (e) => {
          e.preventDefault();
          try {
            const key = await connect();
            toast.success(t("Wallet connected"), {
              description: truncateKey(key),
            });
          } catch {
            // Not authenticated yet — connect() already opened the Privy
            // sign-in modal; the menu re-renders once that completes.
          }
        }}
      >
        <Wallet /> {connecting ? t("Connecting…") : t("Connect Wallet")}
      </DropdownMenuItem>
    );
  }

  // One row: tap anywhere on it to copy the full address.
  return (
    <button
      type="button"
      onClick={copyAddress}
      title={t("Send test SOL to this address to fund it:")}
      className="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors"
    >
      <Wallet className="text-success size-4 shrink-0" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span>{t("Wallet · Test network")}</span>
        <span className="text-muted-foreground font-mono text-xs">{truncateKey(publicKey!)}</span>
      </span>
      {copied ? <Check className="text-success size-4 shrink-0" /> : <Copy className="text-muted-foreground size-4 shrink-0" />}
    </button>
  );
}
