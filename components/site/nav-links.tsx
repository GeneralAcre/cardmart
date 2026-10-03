"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { useT } from "@/components/landing/language-provider";
import { NAV_LINKS as links, isNavEntryActive, isNavLinkActive } from "@/lib/nav-links";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ITEM_CLASS = "eyebrow rounded-full px-3.5 py-2 transition-colors lg:text-[13px]";

// Mobile navigation lives in MobileBottomNav (a fixed footer bar) instead of
// a hamburger dropdown here — easier to reach one-handed and always visible.
export function NavLinks() {
  const pathname = usePathname();
  const t = useT();

  return (
    <nav className="hidden items-center gap-1 md:flex">
      {links.map((l) => {
        const active = isNavEntryActive(pathname, l);
        const stateClass = active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground";

        if (l.children) {
          return (
            <DropdownMenu key={l.label}>
              <DropdownMenuTrigger className={cn(ITEM_CLASS, stateClass, "flex items-center gap-1.5 outline-none")}>
                {t(l.label)}
                <ChevronDown className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-48 rounded-xl p-1.5">
                {l.children.map((child) => {
                  const Icon = child.icon;
                  return (
                    <DropdownMenuItem key={child.href} asChild>
                      <Link
                        href={child.href}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
                          isNavLinkActive(pathname, child.href) ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        <Icon className="size-4" />
                        {t(child.label)}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }

        return (
          <Link key={l.href} href={l.href} className={cn(ITEM_CLASS, stateClass)}>
            {t(l.label)}
          </Link>
        );
      })}
    </nav>
  );
}
