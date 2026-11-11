import Link from "next/link";

import { getOptionalUser } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { getMyNotifications, getUnreadMessageCount, getUnreadNotificationCount } from "@/lib/queries";
import { NavLinks } from "@/components/site/nav-links";
import { MobileBottomNav } from "@/components/site/mobile-bottom-nav";
import { NotificationBell } from "@/components/site/notification-bell";
import { HeaderSearchButton } from "@/components/site/header-search-button";
import { ProfileDrawer } from "@/components/site/profile-drawer";
import { ThemeToggleButton } from "@/components/site/theme-toggle";
import { Logo } from "@/components/site/logo";
import { LoginButton } from "@/components/onboarding/login-button";

export async function SiteHeader() {
  const [user, t] = await Promise.all([getOptionalUser(), getT()]);
  if (!user) return <GuestHeader />;
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
            {/* Phones only: the Market's search box is on a banner slide that rotates away; this brings it back. */}
            <HeaderSearchButton />
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
            {/* Messages and light/dark are in the profile panel. */}
            <ProfileDrawer
              name={displayName}
              handle={user.handle}
              email={user.email}
              image={user.image}
              initials={initials}
              unreadMessageCount={unreadMessageCount}
            />
          </div>
        </div>
      </header>
      <MobileBottomNav />
    </>
  );
}

/**
 * What a visitor who isn't signed in sees: the same menu as everyone else (so
 * they can see what's here), a sign-in button, and no messages, alerts or
 * profile. Pages other than the market ask them to sign in when opened.
 */
function GuestHeader() {
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
            <HeaderSearchButton />
            <ThemeToggleButton />
            <LoginButton size="sm" label="Login" />
          </div>
        </div>
      </header>
      <MobileBottomNav />
    </>
  );
}
