"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { isNavLinkActive, navLinksFor } from "@/lib/nav-links";

// Mobile navigation lives in MobileBottomNav (a fixed footer bar) instead of
// a hamburger dropdown here — easier to reach one-handed and always visible.
export function NavLinks({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const links = navLinksFor(isAdmin);

  return (
    <nav className="hidden items-center gap-1 sm:flex">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-semibold tracking-wide uppercase transition-colors",
            isNavLinkActive(pathname, l.href)
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
          )}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
