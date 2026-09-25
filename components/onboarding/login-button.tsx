"use client";

import { toast } from "sonner";
import { Loader2, Wallet } from "lucide-react";
import { useLogin, usePrivy } from "@privy-io/react-auth";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/landing/language-provider";

// Remembers (per tab, briefly) that we already tried resuming an existing
// Privy session once, so a server that keeps rejecting the token can't
// cause a redirect loop. Storage may be unavailable (private mode), so
// every access is guarded — worst case we just don't retry.
const RETRY_KEY = "cardmart-login-retry";
const RETRY_WINDOW_MS = 15_000;

function recentlyRetried() {
  try {
    const at = Number(sessionStorage.getItem(RETRY_KEY));
    return Boolean(at) && Date.now() - at < RETRY_WINDOW_MS;
  } catch {
    return true;
  }
}

function markRetry() {
  try {
    sessionStorage.setItem(RETRY_KEY, String(Date.now()));
  } catch {}
}

function clearRetry() {
  try {
    sessionStorage.removeItem(RETRY_KEY);
  } catch {}
}

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
    // the user signed in (wasAlreadyAuthenticated). This button only renders
    // when the server saw no valid session, so that case means the
    // privy-token cookie is stale/expired — navigating straight away would
    // bounce back here and loop forever. Refresh the token first (which
    // rewrites the cookie), retry once, and if the server still rejects it,
    // sign out so the user gets a working Login button again.
    onComplete: async ({ wasAlreadyAuthenticated }) => {
      const token = await getAccessToken().catch(() => null);
      if (wasAlreadyAuthenticated) {
        if (!token || recentlyRetried()) {
          clearRetry();
          await logout();
          return;
        }
        markRetry();
      } else {
        clearRetry();
      }
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

  if (authenticated) {
    return (
      <Button type="button" size={size} className={cn("w-full", className)} disabled>
        <Loader2 className="animate-spin" />
        {t.login.redirecting}
      </Button>
    );
  }

  return (
    <Button type="button" size={size} className={cn("w-full", className)} onClick={() => login()} disabled={!ready}>
      {ready ? <Wallet /> : <Loader2 className="animate-spin" />}
      {label ?? t.login.continue}
    </Button>
  );
}
