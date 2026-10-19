import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { getOptionalUser } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { getMyNotifications, getUnreadMessageCount, getUnreadNotificationCount } from "@/lib/queries";
import { NavLinks } from "@/components/site/nav-links";
import { MobileBottomNav } from "@/components/site/mobile-bottom-nav";
import { NotificationBell } from "@/components/site/notification-bell";
import { ProfileDrawer } from "@/components/site/profile-drawer";
import { ThemeToggleButton } from "@/components/site/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/site/logo";
import { LoginButton } from "@/components/onboarding/login-button";

export async function SiteHeader() {
  const [user, t] = await Promise.all([getOptionalUser(), getT()]);
  if (!user) return <GuestHeader label={t("Market")} />;
  const [notifications, unreadCount, unreadMessageCount] = await Promise.all([
    getMyNotifications(user.id),
    getUnreadNotificationCount(user.id),
    getUnreadMessageCount(user.id),
  ]);
  const displayName = user.name ?? user.handle ?? t("Collector");
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <header className="bg-background/90 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between gap-2 px-4 sm:h-[72px] sm:gap-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2 sm:gap-8">
            <Link href="/" className="flex shrink-0 items-center gap-2">
              <Logo />
            </Link>
            <NavLinks />
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-3">
            <Button asChild variant="ghost" size="icon" className="relative rounded-full">
              <Link href="/messages">
                <MessageCircle className="size-4" />
                {unreadMessageCount > 0 && (
                  <Badge className="absolute -right-0.5 -top-0.5 size-4 min-w-4 justify-center rounded-full p-0 text-[10px]">
                    {unreadMessageCount > 9 ? "9+" : unreadMessageCount}
                  </Badge>
                )}
                <span className="sr-only">{t("Messages")}</span>
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
            <ThemeToggleButton />
            <ProfileDrawer name={displayName} handle={user.handle} email={user.email} image={user.image} initials={initials} />
          </div>
        </div>
      </header>
      <MobileBottomNav />
    </>
  );
}

/** What a visitor who isn't signed in sees: just the way to the market and a sign-in button. */
function GuestHeader({ label }: { label: string }) {
  return (
    <header className="bg-background/90 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between gap-2 px-4 sm:h-[72px] sm:gap-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-4 sm:gap-8">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <Logo />
          </Link>
          <Link href="/marketplace" className="text-foreground text-sm font-medium tracking-[0.15em] uppercase">
            {label}
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          <ThemeToggleButton />
          <LoginButton size="sm" label="Login" />
        </div>
      </div>
    </header>
  );
}
