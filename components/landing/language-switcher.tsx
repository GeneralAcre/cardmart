"use client";

import { ChevronDown, Globe } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LOCALES } from "@/lib/i18n/landing";
import { useLanguage } from "@/components/landing/language-provider";
import { cn } from "@/lib/utils";

// Short region codes for the button; the menu spells each language out.
const SHORT_LABEL: Record<string, string> = { en: "US", th: "TH" };

/** The language choice inside the app's profile menu; the landing page uses LanguageSwitcher. */
export function LanguageMenuItems() {
  const { locale, setLocale, tr: t } = useLanguage();
  // One row with a small switch, so changing language doesn't close the menu.
  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-sm">
      <span className="flex items-center gap-2">
        <Globe className="text-muted-foreground size-4" /> {t("Language")}
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
              "rounded px-2 py-0.5 transition-colors",
              l.value === locale ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {l.value.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}

export function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();
  const current = LOCALES.find((l) => l.value === locale);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 px-2 font-semibold"
          aria-label={`Language: ${current?.label}`}
        >
          <Globe className="size-4" />
          {SHORT_LABEL[locale] ?? locale.toUpperCase()}
          <ChevronDown className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LOCALES.map((l) => (
          <DropdownMenuItem key={l.value} onClick={() => setLocale(l.value)} data-active={l.value === locale}>
            {l.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
