"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const BASE_LINKS = [
  { href: "/marketplace", label: "Marketplace" },
  { href: "/verify", label: "Verify" },
  { href: "/portfolio", label: "Portfolio" },
];

const ADMIN_LINK = { href: "/admin/warehouse", label: "Warehouse Admin" };

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function NavLinks({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const LINKS = isAdmin ? [...BASE_LINKS, ADMIN_LINK] : BASE_LINKS;

  return (
    <>
      <nav className="hidden items-center gap-1 sm:flex">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              isActive(pathname, l.href)
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
            )}
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="sm:hidden">
            <Menu />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {LINKS.map((l) => (
            <DropdownMenuItem key={l.href} asChild>
              <Link href={l.href} className={cn(isActive(pathname, l.href) && "font-semibold")}>
                {l.label}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
