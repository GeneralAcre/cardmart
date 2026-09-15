"use client";

import { useRouter } from "next/navigation";
import { Wallet, LogOut } from "lucide-react";
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
  const { connected, connecting, publicKey, connect, disconnect } = useWalletStore();

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
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Solana Wallet</DropdownMenuLabel>
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
