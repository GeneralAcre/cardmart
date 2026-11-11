"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { useT } from "@/components/landing/language-provider";
import { NAV_LINKS as links, isNavEntryActive } from "@/lib/nav-links";

// Primary mobile navigation — fixed to the bottom of the viewport instead of
// tucked behind a hamburger menu in the header, so it's reachable one-handed
// and always visible. Icons are lucide-react placeholders for now.
export function MobileBottomNav() {
  const pathname = usePathname();
  const t = useT();

  return (
    <nav
      data-tour="nav"
      className="bg-background/95 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="grid h-14" style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }}>
        {links.map((l) => {
          const Icon = l.icon;
          const active = isNavEntryActive(pathname, l);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-1 transition-colors",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
              // Icons only on the bar; the name is still read out and shown on long-press.
              aria-label={t(l.shortLabel ?? l.label)}
              aria-current={active ? "page" : undefined}
              title={t(l.shortLabel ?? l.label)}
            >
              <Icon className={cn("size-6", active && "text-primary")} />
              {/* A lime dot marks the current tab, since there's no label to make bold. The dot is always there (clear when inactive) so icons don't shift. */}
              <span aria-hidden className={cn("size-1 rounded-full", active ? "bg-success" : "bg-transparent")} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
