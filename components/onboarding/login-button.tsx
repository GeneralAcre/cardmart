"use client";

import { useRouter } from "next/navigation";
import { Loader2, Wallet } from "lucide-react";
import { useLogin, usePrivy } from "@privy-io/react-auth";

import { Button } from "@/components/ui/button";

export function LoginButton() {
  const router = useRouter();
  const { ready } = usePrivy();
  const { login } = useLogin({
    // Fires after auth AND embedded wallet creation both finish (since
    // embeddedWallets.solana.createOnLogin is "users-without-wallets") —
    // proxy.ts + getCurrentUser() handle sending them to /onboarding or "/".
    onComplete: () => router.push("/"),
  });

  return (
    <Button type="button" size="lg" className="w-full" onClick={() => login()} disabled={!ready}>
      {ready ? <Wallet /> : <Loader2 className="animate-spin" />}
      Continue with Google or Email
    </Button>
  );
}
