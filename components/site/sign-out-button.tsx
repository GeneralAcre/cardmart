"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useT } from "@/components/landing/language-provider";

export function SignOutButton() {
  const router = useRouter();
  const { logout } = usePrivy();
  const t = useT();

  return (
    <DropdownMenuItem
      variant="destructive"
      onSelect={async () => {
        await logout();
        router.push("/");
      }}
    >
      <LogOut /> {t("Sign out")}
    </DropdownMenuItem>
  );
}
