"use client";

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
  const { connected, connecting, publicKey, connect, disconnect } = useWalletStore();

  if (!connected) {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={connecting}
        onClick={async () => {
          const key = await connect();
          toast.success("Mock wallet connected", {
            description: truncateKey(key),
          });
        }}
      >
        <Wallet />
        <span className="hidden sm:inline">{connecting ? "Connecting…" : "Connect Wallet"}</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          <Wallet className="text-emerald-500" />
          <span className="hidden sm:inline">{truncateKey(publicKey!)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Mock Web3 Wallet</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            disconnect();
            toast("Wallet disconnected");
          }}
        >
          <LogOut />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
