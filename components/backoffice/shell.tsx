"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  ExternalLink,
  History,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  Menu,
  PackageCheck,
  PlugZap,
  Scale,
  ScanSearch,
  ShieldCheck,
  Truck,
  Users,
  Vault,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useT } from "@/components/landing/language-provider";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { StaffSignOut } from "@/components/backoffice/staff-sign-out";
import type { BackofficeCounts } from "@/lib/queries";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  count?: keyof BackofficeCounts;
}

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "",
    items: [{ href: "/admin", label: "Overview", icon: LayoutDashboard }],
  },
  {
    title: "Warehouse",
    items: [
      { href: "/admin/inbound", label: "Inbound", icon: ScanSearch, count: "inbound" },
      { href: "/admin/grading", label: "Grading", icon: PackageCheck, count: "grading" },
      { href: "/admin/shipments", label: "Shipments", icon: Truck, count: "shipments" },
      { href: "/admin/vault", label: "Vault", icon: Vault },
    ],
  },
  {
    title: "Trust & safety",
    items: [
      { href: "/admin/disputes", label: "Disputes", icon: Scale, count: "disputes" },
      { href: "/admin/identity", label: "Identity", icon: ShieldCheck, count: "kyc" },
      { href: "/admin/users", label: "Users", icon: Users },
    ],
  },
  {
    title: "Support",
    items: [
      { href: "/admin/support", label: "Support inbox", icon: LifeBuoy, count: "support" },
      { href: "/admin/alerts", label: "Alerts", icon: Bell, count: "alerts" },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/admin/history", label: "History", icon: History },
      { href: "/admin/integrations", label: "Integrations", icon: PlugZap },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

function SidebarNav({ counts, onNavigate }: { counts: BackofficeCounts; onNavigate?: () => void }) {
  const pathname = usePathname();
  const t = useT();

  return (
    <nav className="flex flex-col gap-5 p-3">
      {NAV_SECTIONS.map((section) => (
        <div key={section.title || "top"} className="flex flex-col gap-0.5">
          {section.title && (
            <span className="text-muted-foreground px-3 pb-1 text-[11px] font-semibold tracking-wider uppercase">
              {t(section.title)}
            </span>
          )}
          {section.items.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            const count = item.count ? counts[item.count] : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-accent text-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <Icon className={cn("size-4 shrink-0", active && "text-highlight")} />
                <span className="flex-1 truncate">{t(item.label)}</span>
                {count > 0 && (
                  <span className="bg-highlight text-highlight-foreground min-w-5 rounded-full px-1.5 text-center text-[11px] leading-5 font-semibold tabular-nums">
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function Brand() {
  const t = useT();
  return (
    <Link href="/admin" className="flex items-center gap-2">
      <span className="bg-highlight text-highlight-foreground flex size-7 items-center justify-center rounded-md">
        <Inbox className="size-4" />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-bold tracking-wide uppercase">CardMart</span>
        <span className="text-muted-foreground text-[11px]">{t("Back Office")}</span>
      </span>
    </Link>
  );
}

/**
 * The back office's own chrome: a sidebar of staff queues instead of the
 * marketplace header/footer, so staff tools never mix with the buyer/seller
 * site. Collapses to a slide-out menu on phones.
 */
export function BackofficeShell({
  counts,
  staffName,
  children,
}: {
  counts: BackofficeCounts;
  staffName: string;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const t = useT();

  return (
    <div className="flex min-h-screen flex-1">
      <aside className="bg-card sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r lg:flex">
        <div className="flex h-14 items-center border-b px-4">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav counts={counts} />
        </div>
        <div className="border-t p-3">
          <Link
            href="/marketplace"
            className="text-muted-foreground hover:text-foreground flex items-center gap-2 rounded-md px-3 py-2 text-sm"
          >
            <ExternalLink className="size-4" />
            {t("Open marketplace")}
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/90 sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3 lg:hidden">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger
                aria-label={t("Menu")}
                className="hover:bg-accent -ml-1 flex size-9 items-center justify-center rounded-md"
              >
                <Menu className="size-5" />
              </SheetTrigger>
              <SheetContent side="left" className="w-72 gap-0 p-0">
                <SheetTitle className="flex h-14 items-center border-b px-4">
                  <Brand />
                </SheetTitle>
                <div className="overflow-y-auto">
                  <SidebarNav counts={counts} onNavigate={() => setMenuOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
            <Brand />
          </div>
          <span className="text-muted-foreground hidden text-xs lg:block">{t("Staff only")}</span>
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <span className="truncate font-medium">{staffName}</span>
            <span className="border-highlight/50 text-highlight rounded border px-1.5 text-[10px] font-semibold tracking-wider uppercase">
              {t("Staff")}
            </span>
            <StaffSignOut />
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

export function BackofficePageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6 flex flex-col gap-1">
      <h1 className="text-xl font-semibold">{title}</h1>
      {description && <p className="text-muted-foreground max-w-3xl text-sm">{description}</p>}
    </div>
  );
}
