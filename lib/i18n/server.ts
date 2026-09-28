import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";

import { DEFAULT_LOCALE } from "@/lib/i18n/landing";
import { LOCALE_COOKIE, isLocale, translator, type Locale } from "@/lib/i18n/translate";

/** The visitor's chosen language, from the cookie the language switcher sets. */
export const getLocale = cache(async (): Promise<Locale> => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
});

/** `t()` for Server Components: `const t = await getT();` */
export async function getT() {
  return translator(await getLocale());
}
