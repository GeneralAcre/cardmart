"use client";

import { useRouter } from "next/navigation";
import { Wallet, LogOut, Copy, Check } from "lucide-react";
import { useState } from "react";
import { useWalletStore } from "@/lib/web3/wallet-store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

function truncateKey(key: string) {
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

export function WalletButton() {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const { connected, connecting, publicKey, connect, disconnect } = useWalletStore();

  function copyAddress() {
    if (!publicKey) return;
    navigator.clipboard.writeText(publicKey);
    toast.success("Address copied — safe to send devnet SOL here");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!connected) {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={connecting}
        onClick={async () => {
          try {
            const key = await connect();
            toast.success("Wallet connected", {
              description: truncateKey(key),
            });
          } catch {
            // Not authenticated yet — connect() already opened the Privy
            // sign-in modal; the button re-renders once that completes.
          }
        }}
      >
        <Wallet />
        {connecting ? "Connecting…" : "Connect Wallet"}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          <Wallet className="text-emerald-500" />
          {truncateKey(publicKey!)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Solana Wallet (Devnet)</DropdownMenuLabel>
        <div className="flex flex-col gap-1.5 px-2 pb-2">
          <span className="text-muted-foreground text-[11px]">
            Send devnet SOL to this address to fund it:
          </span>
          <button
            type="button"
            onClick={copyAddress}
            className="bg-muted/50 hover:bg-muted flex items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors"
          >
            <span className="flex-1 truncate font-mono text-xs">{publicKey}</span>
            {copied ? (
              <Check className="text-emerald-600 size-3.5 shrink-0" />
            ) : (
              <Copy className="text-muted-foreground size-3.5 shrink-0" />
            )}
          </button>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            disconnect();
            toast("Signed out");
            router.push("/login");
          }}
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
