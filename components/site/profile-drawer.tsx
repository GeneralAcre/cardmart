"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { BookOpen, Check, ChevronRight, Coins, Copy, Globe, LogOut, MessageCircle, Moon, Settings, Sun, UserRound, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useLanguage } from "@/components/landing/language-provider";
import { LOCALES } from "@/lib/i18n/landing";
import { useCurrency } from "@/components/currency-provider";
import { CURRENCIES } from "@/lib/currency";
import { useWalletStore } from "@/lib/web3/wallet-store";
import { useTheme } from "@/components/site/theme-provider";
import { cn } from "@/lib/utils";

const short = (key: string) => `${key.slice(0, 4)}…${key.slice(-4)}`;

/**
 * The profile panel: the avatar in the header opens it from the right edge,
 * nearly the full width on a phone. Account links (Messages with its unread
 * count), the wallet address, language, currency, light/dark and sign out in
 * one place; the header keeps only the alerts bell and this avatar.
 */
export function ProfileDrawer({
  name,
  handle,
  email,
  image,
  initials,
  unreadMessageCount = 0,
}: {
  name: string;
  handle: string | null;
  email: string | null;
  image: string | null;
  initials: string;
  unreadMessageCount?: number;
}) {
  const router = useRouter();
  const { logout } = usePrivy();
  const { locale, setLocale, tr: t } = useLanguage();
  const { currency, setCurrency } = useCurrency();
  const { theme, setTheme } = useTheme();
  const { connected, connecting, publicKey, connect } = useWalletStore();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  function copyAddress() {
    if (!publicKey) return;
    navigator.clipboard.writeText(publicKey);
    toast.success(t("Address copied — safe to send test SOL here"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function connectWallet() {
    try {
      const key = await connect();
      toast.success(t("Wallet connected"), { description: short(key) });
    } catch {
      // Not signed in to Privy yet: connect() already opened its sign-in modal.
    }
  }

  const links = [
    { href: "/portfolio", icon: UserRound, label: t("Portfolio") },
    { href: "/messages", icon: MessageCircle, label: t("Messages"), badge: unreadMessageCount },
    { href: "/settings", icon: Settings, label: t("Settings") },
    { href: "/guide", icon: BookOpen, label: t("Getting started guide") },
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full" aria-label={t("Profile")}>
          <Avatar>
            {image && <AvatarImage src={image} alt={name} />}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          {/* Messages moved in here from the header, so a dot says there's something unread. */}
          {unreadMessageCount > 0 && (
            <span className="bg-destructive ring-background absolute top-0 right-0 size-2.5 rounded-full ring-2">
              <span className="sr-only">{t("Unread messages")}</span>
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[88vw] max-w-sm gap-0 overflow-y-auto p-0 sm:w-96">
        <SheetTitle className="sr-only">{t("Profile")}</SheetTitle>
        <SheetDescription className="sr-only">{t("Your account, wallet and settings.")}</SheetDescription>

        <div className="flex items-center gap-3 border-b p-4 pr-12">
          <Avatar className="size-12">
            {image && <AvatarImage src={image} alt="" />}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-semibold">{name}</span>
            {handle ? (
              <span className="text-muted-foreground truncate text-sm">@{handle}</span>
            ) : (
              email && <span className="text-muted-foreground truncate text-sm">{email}</span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 border-b p-4">
          <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.2em] uppercase">{t("Wallet · Test network")}</span>
          {connected && publicKey ? (
            <button
              type="button"
              onClick={copyAddress}
              title={t("Send test SOL to this address to fund it:")}
              className="bg-muted/50 hover:bg-muted flex items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Wallet className="text-success size-4 shrink-0" />
                <span className="truncate font-mono text-sm">{short(publicKey)}</span>
              </span>
              {copied ? <Check className="text-success size-4 shrink-0" /> : <Copy className="text-muted-foreground size-4 shrink-0" />}
            </button>
          ) : (
            <Button variant="outline" className="w-full" disabled={connecting} onClick={connectWallet}>
              <Wallet /> {connecting ? t("Connecting…") : t("Connect Wallet")}
            </Button>
          )}
        </div>

        <nav className="flex flex-col border-b">
          {links.map(({ href, icon: Icon, label, badge }) => (
            <SheetClose asChild key={href}>
              <Link href={href} className="hover:bg-accent flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition-colors">
                <span className="bg-muted flex size-9 items-center justify-center rounded-lg">
                  <Icon className="size-4" />
                </span>
                <span className="flex-1">{label}</span>
                {badge ? (
                  <span className="bg-destructive min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] leading-none font-semibold text-white">
                    {badge > 9 ? "9+" : badge}
                  </span>
                ) : null}
                <ChevronRight className="text-muted-foreground size-4" />
              </Link>
            </SheetClose>
          ))}
        </nav>

        <div className="flex items-center justify-between gap-2 border-b px-4 py-3.5 text-sm">
          <span className="flex items-center gap-3 font-medium">
            <span className="bg-muted flex size-9 items-center justify-center rounded-lg">
              <Globe className="size-4" />
            </span>
            {t("Language")}
          </span>
          <div className="bg-muted flex rounded-md p-0.5 text-xs font-semibold" role="group" aria-label={t("Language")}>
            {LOCALES.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => setLocale(l.value)}
                aria-pressed={l.value === locale}
                title={l.label}
                className={cn(
                  "rounded px-2.5 py-1 transition-colors",
                  l.value === locale ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {l.value.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Prices are stored and paid in baht; this only changes how they read. */}
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3.5 text-sm">
          <span className="flex items-center gap-3 font-medium">
            <span className="bg-muted flex size-9 items-center justify-center rounded-lg">
              <Coins className="size-4" />
            </span>
            {t("Currency")}
          </span>
          <div className="bg-muted flex rounded-md p-0.5 text-xs font-semibold" role="group" aria-label={t("Currency")}>
            {CURRENCIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCurrency(c.value)}
                aria-pressed={c.value === currency}
                title={t(c.label)}
                className={cn(
                  "rounded px-2.5 py-1 transition-colors",
                  c.value === currency ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {c.value}
              </button>
            ))}
          </div>
        </div>

        {/* Light or dark, the same small switch as Language and Currency. */}
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3.5 text-sm">
          <span className="flex items-center gap-3 font-medium">
            <span className="bg-muted flex size-9 items-center justify-center rounded-lg">
              {theme === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
            </span>
            {t("Screen mode")}
          </span>
          <div className="bg-muted flex rounded-md p-0.5 text-xs font-semibold" role="group" aria-label={t("Screen mode")}>
            {(
              [
                { value: "light", label: t("Light") },
                { value: "dark", label: t("Dark") },
              ] as const
            ).map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setTheme(m.value)}
                aria-pressed={m.value === theme}
                className={cn(
                  "rounded px-2.5 py-1 transition-colors",
                  m.value === theme ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-auto p-4">
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive w-full justify-start"
            onClick={async () => {
              await logout();
              setOpen(false);
              router.push("/");
            }}
          >
            <LogOut /> {t("Sign out")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
