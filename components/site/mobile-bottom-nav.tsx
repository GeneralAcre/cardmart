"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { isNavLinkActive, navLinksFor } from "@/lib/nav-links";

// Primary mobile navigation — fixed to the bottom of the viewport instead of
// tucked behind a hamburger menu in the header, so it's reachable one-handed
// and always visible. Icons are lucide-react placeholders for now.
export function MobileBottomNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const links = navLinksFor(isAdmin);

  return (
    <nav
      className="bg-background/95 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="grid h-14" style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }}>
        {links.map((l) => {
          const Icon = l.icon;
          const active = isNavLinkActive(pathname, l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className={cn("size-5", active && "text-primary")} />
              {l.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
