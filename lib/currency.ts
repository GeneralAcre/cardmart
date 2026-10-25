// The currency prices are shown in. Every price is stored and charged in baht;
// this only changes how it reads. Safe to import from client components.
//
// The rates are the app's fixed ones (lib/pricing.ts): THB_PER_SOL is exactly
// what the escrow locks, so a price shown in SOL is what the buyer's wallet
// pays. Fields where people type an amount stay in baht.
import { formatThb } from "@/lib/format";
import { THB_PER_SOL, THB_PER_USD } from "@/lib/pricing";

export type Currency = "THB" | "USD" | "SOL";

export const CURRENCIES: { value: Currency; label: string }[] = [
  { value: "THB", label: "Thai baht" },
  { value: "USD", label: "US dollar" },
  { value: "SOL", label: "Solana" },
];

export const CURRENCY_COOKIE = "cardmart-currency";
export const DEFAULT_CURRENCY: Currency = "THB";

export const isCurrency = (value: string | null | undefined): value is Currency =>
  value === "THB" || value === "USD" || value === "SOL";

/** A baht amount, written in the chosen currency: "THB 33,500", "$1,015", "6.7 SOL". */
export function formatMoney(amountThb: number, currency: Currency): string {
  if (currency === "USD") {
    const usd = amountThb / THB_PER_USD;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      // Cents only where they matter, so big prices stay short.
      maximumFractionDigits: Math.abs(usd) < 100 ? 2 : 0,
    }).format(usd);
  }
  if (currency === "SOL") {
    const sol = amountThb / THB_PER_SOL;
    const abs = Math.abs(sol);
    const digits = abs < 1 ? 4 : abs < 100 ? 2 : 0;
    return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(sol)} SOL`;
  }
  return formatThb(amountThb);
}

/** formatMoney with the currency already picked: what useMoney() and getMoney() hand out. */
export type Money = (amountThb: number) => string;

export const moneyFormatter =
  (currency: Currency): Money =>
  (amountThb) =>
    formatMoney(amountThb, currency);
