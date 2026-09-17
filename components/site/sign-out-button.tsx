"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function SignOutButton() {
  const router = useRouter();
  const { logout } = usePrivy();

  return (
    <DropdownMenuItem
      variant="destructive"
      onSelect={async () => {
        await logout();
        router.push("/");
      }}
    >
      <LogOut /> Sign out
    </DropdownMenuItem>
  );
}
