"use client";

import { toast } from "sonner";
import { Loader2, Wallet } from "lucide-react";
import { useLogin, usePrivy } from "@privy-io/react-auth";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/landing/language-provider";

export function LoginButton({
  className,
  size = "lg",
  label,
}: {
  className?: string;
  size?: "sm" | "default" | "lg";
  label?: string;
}) {
  const { t } = useLanguage();
  const { ready, authenticated, getAccessToken, logout } = usePrivy();
  const { login } = useLogin({
    // Fires after auth AND embedded wallet creation both finish (since
    // embeddedWallets.solana.createOnLogin is "users-without-wallets").
    //
    // Hard navigation on purpose, not router.push(): Privy's own client
    // state flips to authenticated slightly before the privy-id-token
    // cookie is actually readable by the server, so an immediate soft
    // navigation could race a server request that still sees no session
    // and bounces back to "/". A full page load gives the cookie time to
    // land before proxy.ts / getCurrentUser() re-check it.
    //
    // onComplete ALSO fires on mount when Privy's client already considers
    // the user signed in (wasAlreadyAuthenticated). Ignore that case: the
    // landing page must never move anyone into the app on its own — only an
    // actual click on Login does (see handleClick below).
    onComplete: ({ wasAlreadyAuthenticated }) => {
      if (wasAlreadyAuthenticated) return;
      window.location.href = "/marketplace";
    },
    // Surfaces a visible reason instead of silently doing nothing — e.g.
    // when a login method is rejected by the Privy dashboard config.
    // Deliberately NOT tracking our own "pending" flag to disable the
    // button here: if the modal gets dismissed without onComplete or
    // onError firing (e.g. the user just closes it), a locally-managed
    // disabled state would never reset and the button would be stuck for
    // good. Staying purely derived from Privy's own ready/authenticated
    // state means it always reflects reality.
    onError: (error) => {
      toast.error("Sign-in failed", { description: error });
    },
  });

  // This button only renders when the server saw no valid session. If
  // Privy's client still has one anyway, the privy-token cookie is just
  // stale — refreshing the access token rewrites it, so the click can go
  // straight through without re-opening the modal. If the refresh fails,
  // sign out and fall back to a normal login.
  async function handleClick() {
    if (!authenticated) {
      login();
      return;
    }
    const token = await getAccessToken().catch(() => null);
    if (token) {
      window.location.href = "/marketplace";
      return;
    }
    await logout();
    login();
  }

  return (
    <Button type="button" size={size} className={cn("w-full", className)} onClick={handleClick} disabled={!ready}>
      {ready ? <Wallet /> : <Loader2 className="animate-spin" />}
      {label ?? t.login.continue}
    </Button>
  );
}
