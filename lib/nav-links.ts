import type { LucideIcon } from "lucide-react";
import { ClipboardList, Gavel, Trophy, ShieldCheck, Store, Wallet } from "lucide-react";

export interface NavLink {
  href: string;
  label: string;
  /** Shorter label for the phone bottom bar, where up to 6 items share ~390px. */
  shortLabel?: string;
  icon: LucideIcon;
}

const BASE_NAV_LINKS: NavLink[] = [
  { href: "/marketplace", label: "Marketplace", shortLabel: "Market", icon: Store },
  { href: "/leaderboard", label: "Leaderboard", shortLabel: "Ranking", icon: Trophy },
  { href: "/auctions", label: "Auctions", icon: Gavel },
  { href: "/listing", label: "Listing", icon: ClipboardList },
  { href: "/portfolio", label: "Portfolio", icon: Wallet },
];

// Icons here are placeholders (lucide-react) until custom symbols are ready
// — swap NavLink.icon per entry when those land, nothing else needs to change.
const ADMIN_NAV_LINK: NavLink = { href: "/admin/warehouse", label: "Admin", icon: ShieldCheck };

export function navLinksFor(isAdmin: boolean): NavLink[] {
  return isAdmin ? [...BASE_NAV_LINKS, ADMIN_NAV_LINK] : BASE_NAV_LINKS;
}

export function isNavLinkActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
