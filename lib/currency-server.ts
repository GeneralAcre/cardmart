import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";

import { CURRENCY_COOKIE, DEFAULT_CURRENCY, isCurrency, moneyFormatter, type Currency, type Money } from "@/lib/currency";

/** The visitor's chosen display currency, from the cookie the currency picker sets. */
export const getCurrency = cache(async (): Promise<Currency> => {
  const value = (await cookies()).get(CURRENCY_COOKIE)?.value;
  return isCurrency(value) ? value : DEFAULT_CURRENCY;
});

/** Price formatting for Server Components: `const money = await getMoney();` */
export async function getMoney(): Promise<Money> {
  return moneyFormatter(await getCurrency());
}
