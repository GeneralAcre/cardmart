import type { LucideIcon } from "lucide-react";
import { ClipboardList, Gavel, Trophy, Store, Wallet } from "lucide-react";

export interface NavLink {
  href: string;
  label: string;
  /** Shorter label for the phone bottom bar, where up to 6 items share ~390px. */
  shortLabel?: string;
  icon: LucideIcon;
}

// Icons here are placeholders (lucide-react) until custom symbols are ready
// — swap NavLink.icon per entry when those land, nothing else needs to change.
// Staff tools are deliberately not linked from here: the back office is its
// own site at /admin (app/(backoffice)), reached by URL only.
export const NAV_LINKS: NavLink[] = [
  { href: "/marketplace", label: "Marketplace", shortLabel: "Market", icon: Store },
  { href: "/leaderboard", label: "Leaderboard", shortLabel: "Ranking", icon: Trophy },
  { href: "/auctions", label: "Auctions", icon: Gavel },
  { href: "/listing", label: "Listing", icon: ClipboardList },
  { href: "/portfolio", label: "Portfolio", icon: Wallet },
];

export function isNavLinkActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
