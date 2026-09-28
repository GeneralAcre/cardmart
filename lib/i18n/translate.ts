import type { Locale } from "@/lib/i18n/landing";
import { TH } from "@/lib/i18n/th";

export type { Locale };
export type TranslateVars = Record<string, string | number>;
export type Translate = (text: string, vars?: TranslateVars) => string;

// The app's UI text is written in English right in the components and
// wrapped in t("…"): the English string itself is the key, and lib/i18n/th.ts
// maps it to Thai. Anything without a Thai entry just shows the English, so
// a missing translation never breaks a page. "{name}" placeholders are
// filled from `vars` after translating, so word order can differ per language.
export const LOCALE_COOKIE = "cardmart-locale";

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "en" || value === "th";
}

export function translate(locale: Locale, text: string, vars?: TranslateVars): string {
  const template = locale === "th" ? (TH[text] ?? text) : text;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

export function translator(locale: Locale): Translate {
  return (text, vars) => translate(locale, text, vars);
}
