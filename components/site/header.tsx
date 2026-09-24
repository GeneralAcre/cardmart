import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { getCurrentUser } from "@/lib/session";
import { getMyNotifications, getUnreadMessageCount, getUnreadNotificationCount } from "@/lib/queries";
import { WalletButton } from "@/components/site/wallet-button";
import { NavLinks } from "@/components/site/nav-links";
import { MobileBottomNav } from "@/components/site/mobile-bottom-nav";
import { NotificationBell } from "@/components/site/notification-bell";
import { SignOutButton } from "@/components/site/sign-out-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
  const [notifications, unreadCount, unreadMessageCount] = await Promise.all([
    getMyNotifications(user.id),
    getUnreadNotificationCount(user.id),
    getUnreadMessageCount(user.id),
  ]);
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
            <Link href="/" className="flex shrink-0 items-center gap-2 text-lg font-bold tracking-wide uppercase">
              <span>CardMart</span>
            </Link>
            <NavLinks isAdmin={user.isAdmin} />
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Button asChild variant="ghost" size="icon" className="relative rounded-full">
              <Link href="/messages">
                <MessageCircle className="size-4" />
                {unreadMessageCount > 0 && (
                  <Badge className="absolute -right-0.5 -top-0.5 size-4 min-w-4 justify-center rounded-full p-0 text-[10px]">
                    {unreadMessageCount > 9 ? "9+" : unreadMessageCount}
                  </Badge>
                )}
                <span className="sr-only">Messages</span>
              </Link>
            </Button>
            <NotificationBell
              initialNotifications={notifications.map((n) => ({
                id: n.id,
                title: n.title,
                body: n.body,
                href: n.href,
                readAt: n.readAt?.toISOString() ?? null,
                createdAt: n.createdAt.toISOString(),
              }))}
              initialUnreadCount={unreadCount}
            />
            <WalletButton />
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
