import Link from "next/link";
import { Gem, LogOut } from "lucide-react";

import { signOut } from "@/auth";
import { getCurrentUser } from "@/lib/session";
import { WalletButton } from "@/components/site/wallet-button";
import { NavLinks } from "@/components/site/nav-links";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export async function SiteHeader() {
  const user = await getCurrentUser();
  const displayName = user.name ?? user.handle ?? "Collector";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-6">
          <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
            <Gem className="text-primary size-5 shrink-0" />
            <span className="hidden sm:inline">Phygital</span>
          </Link>
          <NavLinks />
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <WalletButton />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="rounded-full">
                <Avatar>
                  {user.image && <AvatarImage src={user.image} alt={displayName} />}
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="flex flex-col">
                <span className="font-medium">{displayName}</span>
                {user.email && <span className="text-muted-foreground text-xs">{user.email}</span>}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              >
                <DropdownMenuItem variant="destructive" asChild>
                  <button type="submit" className="w-full">
                    <LogOut /> Sign out
                  </button>
                </DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
