"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Wallet } from "lucide-react";
import { useConnectWallet, useLoginWithSiws, usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/landing/language-provider";

// Wallet login in two user-clicked steps — connect, then sign — instead of
// Privy's built-in "wallet" login method. Privy's modal fires the sign
// request the instant the wallet connects, and Phantom rejects that one on
// its own (no popup, surfaced only as generic_connect_wallet_error). The
// same connect + sign works reliably when the sign comes from its own click,
// so this does exactly that, then hands the signature to Privy's SIWS login.
export function WalletLoginButton({
  className,
  size = "lg",
  redirectTo = "/marketplace",
}: {
  className?: string;
  size?: "sm" | "default" | "lg";
  redirectTo?: string;
}) {
  const { tr } = useLanguage();
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { generateSiwsMessage, loginWithSiws } = useLoginWithSiws();
  const [address, setAddress] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  // Privy fires connectWallet callbacks on every mounted hook, and the
  // landing page renders this button twice (nav + hero) — only the one
  // actually clicked should react.
  const pending = useRef(false);

  const { connectWallet } = useConnectWallet({
    onSuccess: ({ wallet }) => {
      if (!pending.current) return;
      pending.current = false;
      setAddress(wallet.address);
    },
    onError: (error) => {
      if (!pending.current) return;
      pending.current = false;
      if (error !== "exited_auth_flow") toast.error(tr("Sign-in failed"), { description: error });
    },
  });

  const wallet = wallets.find((w) => w.address === address);

  function handleClick() {
    if (authenticated) {
      window.location.href = redirectTo;
      return;
    }
    pending.current = true;
    connectWallet({ walletChainType: "solana-only" });
  }

  async function handleSign() {
    if (!wallet) return;
    setSigning(true);
    try {
      const message = await generateSiwsMessage({ address: wallet.address });
      const { signature } = await wallet.signMessage({ message: new TextEncoder().encode(message) });
      await loginWithSiws({
        message,
        signature: btoa(String.fromCharCode(...signature)),
        walletClientType: wallet.standardWallet.name.toLowerCase(),
        connectorType: "solana_adapter",
      });
      // Hard navigation for the same cookie-timing reason as LoginButton.
      window.location.href = redirectTo;
    } catch (e) {
      setSigning(false);
      const message = e instanceof Error ? e.message : String(e);
      toast.error(tr("Sign-in failed"), { description: message });
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={size}
        className={cn("w-full", className)}
        onClick={handleClick}
        disabled={!ready}
      >
        <Wallet />
        {tr("Log in with Solana wallet")}
      </Button>
      <Dialog open={address !== null} onOpenChange={(open) => !open && !signing && setAddress(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{tr("Sign in with {wallet}", { wallet: wallet?.standardWallet.name ?? tr("your wallet") })}</DialogTitle>
            <DialogDescription>
              {tr("Your wallet will ask you to sign a message to prove it's yours. It's free and doesn't send a transaction.")}
            </DialogDescription>
          </DialogHeader>
          <p className="text-muted-foreground truncate font-mono text-xs">{address}</p>
          <DialogFooter>
            <Button type="button" className="w-full" onClick={handleSign} disabled={!wallet || signing}>
              {signing ? <Loader2 className="animate-spin" /> : <Wallet />}
              {tr("Sign in")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
