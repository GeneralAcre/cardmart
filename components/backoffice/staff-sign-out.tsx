"use client";

import { LogOut } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";

import { Button } from "@/components/ui/button";
import { useT } from "@/components/landing/language-provider";

// Plain-button sign-out for the back office (the marketplace's SignOutButton
// is a dropdown menu item). Hard navigation so the server sees the cleared
// session straight away and shows the staff sign-in page again.
export function StaffSignOut({ variant = "ghost" }: { variant?: "ghost" | "outline" }) {
  const { logout } = usePrivy();
  const t = useT();

  return (
    <Button
      type="button"
      size="sm"
      variant={variant}
      onClick={async () => {
        await logout();
        window.location.href = "/staff-login";
      }}
    >
      <LogOut /> {t("Sign out")}
    </Button>
  );
}
