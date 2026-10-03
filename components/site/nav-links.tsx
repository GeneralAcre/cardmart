"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { useT } from "@/components/landing/language-provider";
import { NAV_LINKS as links, isNavLinkActive } from "@/lib/nav-links";

// Mobile navigation lives in MobileBottomNav (a fixed footer bar) instead of
// a hamburger dropdown here — easier to reach one-handed and always visible.
export function NavLinks() {
  const pathname = usePathname();
  const t = useT();

  return (
    <nav className="hidden items-center gap-1 md:flex">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={cn(
            "eyebrow rounded-full px-3.5 py-2 transition-colors lg:text-[13px]",
            isNavLinkActive(pathname, l.href)
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t(l.label)}
        </Link>
      ))}
    </nav>
  );
}
