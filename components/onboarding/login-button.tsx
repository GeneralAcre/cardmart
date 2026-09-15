"use client";

import { toast } from "sonner";
import { Loader2, Wallet } from "lucide-react";
import { useLogin, usePrivy } from "@privy-io/react-auth";

import { Button } from "@/components/ui/button";

export function LoginButton() {
  const { ready, authenticated } = usePrivy();
  const { login } = useLogin({
    // Fires after auth AND embedded wallet creation both finish (since
    // embeddedWallets.solana.createOnLogin is "users-without-wallets").
    //
    // Hard navigation on purpose, not router.push(): Privy's own client
    // state flips to authenticated slightly before the privy-id-token
    // cookie is actually readable by the server, so an immediate soft
    // navigation could race a server request that still sees no session
    // and bounces back to /login. A full page load gives the cookie time
    // to land before proxy.ts / getCurrentUser() re-check it.
    onComplete: () => {
      window.location.href = "/";
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
      <Button type="button" size="lg" className="w-full" disabled>
        <Loader2 className="animate-spin" />
        Redirecting…
      </Button>
    );
  }

  return (
    <Button type="button" size="lg" className="w-full" onClick={() => login()} disabled={!ready}>
      {ready ? <Wallet /> : <Loader2 className="animate-spin" />}
      Continue with Google or Email
    </Button>
  );
}
