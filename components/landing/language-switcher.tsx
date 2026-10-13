"use client";

import { Check, ChevronDown, Globe } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LOCALES } from "@/lib/i18n/landing";
import { useLanguage } from "@/components/landing/language-provider";

// Short region codes for the button; the menu spells each language out.
const SHORT_LABEL: Record<string, string> = { en: "US", th: "TH" };

/** The language choice inside the app's profile menu; the landing page uses LanguageSwitcher. */
export function LanguageMenuItems() {
  const { locale, setLocale, tr: t } = useLanguage();
  return (
    <>
      <span className="text-muted-foreground flex items-center gap-1.5 px-2 pt-1.5 pb-1 text-xs">
        <Globe className="size-3.5" /> {t("Language")}
      </span>
      {LOCALES.map((l) => (
        <DropdownMenuItem key={l.value} onSelect={() => setLocale(l.value)} data-active={l.value === locale}>
          <span className="w-4">{l.value === locale && <Check className="size-4" />}</span>
          {l.label}
        </DropdownMenuItem>
      ))}
    </>
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
