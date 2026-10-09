// English → Thai for the app UI, split by area. Keys are the exact English
// strings passed to t() — see lib/i18n/translate.ts.
import { ADMIN } from "@/lib/i18n/th/admin";
import { AGENT } from "@/lib/i18n/th/agent";
import { AUCTION } from "@/lib/i18n/th/auction";
import { BACKOFFICE } from "@/lib/i18n/th/backoffice";
import { COMMON } from "@/lib/i18n/th/common";
import { FAQ } from "@/lib/i18n/th/faq";
import { ITEM } from "@/lib/i18n/th/item";
import { LEADERBOARD } from "@/lib/i18n/th/leaderboard";
import { LISTING } from "@/lib/i18n/th/listing";
import { MARKETPLACE } from "@/lib/i18n/th/marketplace";
import { ORDERS } from "@/lib/i18n/th/orders";
import { PAGES } from "@/lib/i18n/th/pages";
import { PORTFOLIO } from "@/lib/i18n/th/portfolio";

export const TH: Record<string, string> = {
  // First, so an existing translation of a shared word ("Auctions") wins.
  ...FAQ,
  ...COMMON,
  ...MARKETPLACE,
  ...ITEM,
  ...AUCTION,
  ...LISTING,
  ...PORTFOLIO,
  ...LEADERBOARD,
  ...PAGES,
  ...ADMIN,
  ...BACKOFFICE,
  ...ORDERS,
  ...AGENT,
};
