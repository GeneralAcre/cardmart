"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";

import { DEFAULT_LOCALE, LANDING_DICTIONARY, type LandingDictionary, type Locale } from "@/lib/i18n/landing";

const STORAGE_KEY = "proof-locale";

function isLocale(value: string | null): value is Locale {
  return value === "en" || value === "th";
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot(): Locale {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isLocale(stored) ? stored : DEFAULT_LOCALE;
}

function getServerSnapshot(): Locale {
  return DEFAULT_LOCALE;
}

type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: LandingDictionary;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

// Client-only preference, scoped to the landing page — no route segments or
// server-side negotiation, just a toggle that defaults to English and
// remembers the visitor's choice for next time. Reads through
// useSyncExternalStore (server snapshot = default locale) rather than
// useState+useEffect, so there's no setState-in-effect and no hydration
// mismatch once the real (possibly stored) locale is picked up client-side.
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setLocale = (next: Locale) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    // The native "storage" event only fires in *other* tabs, so dispatch it
    // manually here to make our own subscriber re-read the new value.
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: next }));
  };

  const value = useMemo(() => ({ locale, setLocale, t: LANDING_DICTIONARY[locale] }), [locale]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
