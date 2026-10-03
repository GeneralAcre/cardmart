"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { useT } from "@/components/landing/language-provider";
import { COMMUNITY_LINKS, isNavLinkActive } from "@/lib/nav-links";

/** The Leaderboard | News switch at the top of every Community page. */
export function CommunityTabs() {
  const pathname = usePathname();
  const t = useT();

  return (
    <nav className="bg-card flex w-fit rounded-lg border p-0.5 text-sm font-medium">
      {COMMUNITY_LINKS.map(({ href, label, icon: Icon }) => {
        const active = isNavLinkActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-md px-3.5 py-1.5 transition-colors",
              active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {t(label)}
          </Link>
        );
      })}
    </nav>
  );
}
