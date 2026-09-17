import Link from "next/link";
import { Gem } from "lucide-react";

import { getCurrentUser } from "@/lib/session";
import { WalletButton } from "@/components/site/wallet-button";
import { NavLinks } from "@/components/site/nav-links";
import { MobileBottomNav } from "@/components/site/mobile-bottom-nav";
import { SignOutButton } from "@/components/site/sign-out-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
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
    <>
      <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-6">
            <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
              <Gem className="text-primary size-5 shrink-0" />
              <span className="hidden sm:inline">Provenance</span>
            </Link>
            <NavLinks isAdmin={user.isAdmin} />
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="hidden sm:block">
              <WalletButton />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar>
                    {user.image && <AvatarImage src={user.image} alt={displayName} />}
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="flex flex-col">
                  <span className="font-medium">{displayName}</span>
                  {user.email && <span className="text-muted-foreground text-xs">{user.email}</span>}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <SignOutButton />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <MobileBottomNav isAdmin={user.isAdmin} />
    </>
  );
}
