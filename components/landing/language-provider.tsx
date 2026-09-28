"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { LANDING_DICTIONARY, type LandingDictionary } from "@/lib/i18n/landing";
import { LOCALE_COOKIE, isLocale, translator, type Locale, type Translate } from "@/lib/i18n/translate";

// Older builds kept the choice only here, in localStorage.
const STORAGE_KEY = "proof-locale";

function persist(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Storage can be blocked (private mode) — the cookie is what matters.
  }
}

type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** Landing-page copy (structured dictionary in lib/i18n/landing.ts). */
  t: LandingDictionary;
  /** App UI text: tr("English text") — see lib/i18n/translate.ts. */
  tr: Translate;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

// The choice lives in a cookie so Server Components render in the right
// language too (lib/i18n/server.ts); the root layout reads it and passes it
// in here, so server and client always agree and nothing flashes. Switching
// re-renders the client right away and refreshes the server-rendered parts.
export function LanguageProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  // One-time carry-over for visitors who picked Thai before the cookie existed.
  useEffect(() => {
    if (document.cookie.includes(`${LOCALE_COOKIE}=`)) return;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      return;
    }
    if (isLocale(stored) && stored !== initialLocale) {
      persist(stored);
      router.refresh();
    }
  }, [initialLocale, router]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      setLocale: (next: Locale) => {
        persist(next);
        setLocaleState(next);
        router.refresh();
      },
      t: LANDING_DICTIONARY[locale],
      tr: translator(locale),
    }),
    [locale, router],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}

/** `t()` for Client Components: `const t = useT();` */
export function useT(): Translate {
  return useLanguage().tr;
}
