"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { CURRENCY_COOKIE, moneyFormatter, type Currency, type Money } from "@/lib/currency";

type CurrencyContextValue = {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  money: Money;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

// Works like LanguageProvider: the choice lives in a cookie so Server
// Components show the same currency (lib/currency-server.ts); the root layout
// reads it and passes it in, so server and client agree and nothing flashes.
// Switching re-renders the client right away and refreshes the server parts.
export function CurrencyProvider({ initialCurrency, children }: { initialCurrency: Currency; children: React.ReactNode }) {
  const router = useRouter();
  const [currency, setCurrencyState] = useState<Currency>(initialCurrency);

  const value = useMemo<CurrencyContextValue>(
    () => ({
      currency,
      setCurrency: (next: Currency) => {
        document.cookie = `${CURRENCY_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
        setCurrencyState(next);
        router.refresh();
      },
      money: moneyFormatter(currency),
    }),
    [currency, router],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within a CurrencyProvider");
  return ctx;
}

/** Price formatting for client components: `const money = useMoney();` then `money(priceThb)`. */
export function useMoney(): Money {
  return useCurrency().money;
}
