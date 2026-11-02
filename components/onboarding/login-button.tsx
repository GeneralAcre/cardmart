"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/landing/language-provider";
import { LoginDialog } from "@/components/onboarding/login-dialog";

export function LoginButton({
  className,
  size = "lg",
  label,
  redirectTo = "/marketplace",
}: {
  className?: string;
  size?: "sm" | "default" | "lg";
  label?: string;
  /** Where to land after signing in — the staff sign-in page sends people to /admin instead. */
  redirectTo?: string;
}) {
  const { t } = useLanguage();
  const { ready, authenticated, getAccessToken, logout } = usePrivy();
  const [open, setOpen] = useState(false);

  // This button only renders when the server saw no valid session. If
  // Privy's client still has one anyway, the privy-token cookie is just
  // stale — refreshing the access token rewrites it, so the click can go
  // straight through without opening the sign-in window. If the refresh
  // fails, sign out and fall back to a normal sign-in.
  async function handleClick() {
    if (!authenticated) {
      setOpen(true);
      return;
    }
    const token = await getAccessToken().catch(() => null);
    if (token) {
      window.location.href = redirectTo;
      return;
    }
    await logout();
    setOpen(true);
  }

  return (
    <>
      <Button type="button" size={size} className={cn("w-full", className)} onClick={handleClick} disabled={!ready}>
        {!ready && <Loader2 className="animate-spin" />}
        {label ?? t.login.continue}
      </Button>
      <LoginDialog open={open} onOpenChange={setOpen} redirectTo={redirectTo} />
    </>
  );
}
