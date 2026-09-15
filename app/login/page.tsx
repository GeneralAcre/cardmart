import { Gem, ShieldCheck } from "lucide-react";

import { LoginButton } from "@/components/onboarding/login-button";

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-xl border p-8 text-center shadow-sm">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <Gem className="text-primary size-5" />
          <span>Provenance</span>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Join the marketplace</h1>
          <p className="text-muted-foreground text-sm">
            Sign in with Google or email to browse, verify, and trade
            certified collectibles secured by physical escrow.
          </p>
        </div>

        <LoginButton />

        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <ShieldCheck className="size-3.5" />
          No wallet? One is created for you automatically on sign-in.
        </div>
      </div>
    </div>
  );
}
