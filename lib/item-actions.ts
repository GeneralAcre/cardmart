// The card page's price box and seller box share one shape: the details on the
// left, the button inside the box on the right in a fixed-width slot, so both
// buttons (Buy now, Message Seller) are the same size and line up at every
// screen size; on phones the slot is just narrower.
//
// These live in a plain module, not in buy-panel.tsx: that file is "use client",
// and a Server Component (the card page, which draws the seller box) importing
// a plain value from a client module gets a reference stand-in, not the string.
export const ITEM_ACTION_BOX_CLASS = "detail-panel flex items-center gap-3 rounded-2xl border p-4 sm:gap-4";
export const ITEM_ACTION_SLOT_CLASS = "w-36 shrink-0 sm:w-40";
export const ITEM_ACTION_BUTTON_CLASS = "h-11 w-full rounded-xl px-3 text-sm font-semibold";
