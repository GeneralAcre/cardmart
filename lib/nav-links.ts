import type { LucideIcon } from "lucide-react";
import { Bot, Gavel, Newspaper, Store, Trophy, Users, Wallet } from "lucide-react";

export interface NavChild {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavLink {
  href: string;
  label: string;
  /** Shorter label for the phone bottom bar, where up to 6 items share ~390px. */
  shortLabel?: string;
  icon: LucideIcon;
  /** Sub-pages: the desktop nav shows a dropdown; the phone bar links to `href`. */
  children?: NavChild[];
}

// Icons here are placeholders (lucide-react) until custom symbols are ready
// — swap NavLink.icon per entry when those land, nothing else needs to change.
// Staff tools are deliberately not linked from here: the back office is its
// own site at /admin (app/(backoffice)), reached by URL only. Selling lives
// inside the Marketplace (/marketplace/sell), so it has no tab of its own.
export const COMMUNITY_LINKS: NavChild[] = [
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/news", label: "News", icon: Newspaper },
];

export const NAV_LINKS: NavLink[] = [
  { href: "/marketplace", label: "Market", icon: Store },
  { href: "/leaderboard", label: "Community", icon: Users, children: COMMUNITY_LINKS },
  { href: "/auctions", label: "Auctions", icon: Gavel },
  { href: "/agent", label: "Agent", icon: Bot },
  { href: "/portfolio", label: "Portfolio", icon: Wallet },
];

export function isNavLinkActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** A top-level entry is active when its own page or any of its sub-pages is open. */
export function isNavEntryActive(pathname: string, link: NavLink): boolean {
  return link.children
    ? link.children.some((child) => isNavLinkActive(pathname, child.href))
    : isNavLinkActive(pathname, link.href);
}
