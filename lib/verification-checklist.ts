import type { AssetCategory } from "@prisma/client";

export interface VerificationView {
  key: string;
  label: string;
  hint: string;
}

/**
 * Required live-camera capture points for an already-graded slab. Every
 * view must be captured live (no gallery uploads) before a Self-Mint
 * listing can be created — this is the actual proof of physical possession
 * that replaces a simple photo upload, which anyone could screenshot or
 * reuse.
 */
export const GRADED_VERIFICATION_CHECKLIST: Record<AssetCategory, VerificationView[]> = {
  TRADING_CARD: [
    { key: "slab_front", label: "Slab Front", hint: "Full front of the encapsulated card, centered" },
    { key: "slab_back", label: "Slab Back", hint: "Full back of the case" },
    { key: "cert_label", label: "Certification Label", hint: "Close-up of the serial number and grade sticker" },
    { key: "corner_closeup", label: "Corner Close-up", hint: "Close-up of one case corner for damage or tampering" },
  ],
  SPORTS_CARD: [
    { key: "slab_front", label: "Slab Front", hint: "Full front of the encapsulated card, centered" },
    { key: "slab_back", label: "Slab Back", hint: "Full back of the case" },
    { key: "cert_label", label: "Certification Label", hint: "Close-up of the serial number and grade sticker" },
    { key: "corner_closeup", label: "Corner Close-up", hint: "Close-up of one case corner for damage or tampering" },
  ],
  COMIC: [
    { key: "slab_front", label: "Slab Front", hint: "Full front cover through the case" },
    { key: "slab_back", label: "Slab Back", hint: "Full back of the case" },
    { key: "cert_label", label: "Certification Label", hint: "Close-up of the serial number and grade sticker" },
    { key: "spine_closeup", label: "Spine Close-up", hint: "Close-up of the spine through the case" },
  ],
};

/**
 * Required live-camera capture points for a raw/ungraded item — no slab, no
 * certificate label, so the checklist instead focuses on the condition
 * details a grading company would normally check (corners, surface).
 */
export const RAW_VERIFICATION_CHECKLIST: Record<AssetCategory, VerificationView[]> = {
  TRADING_CARD: [
    { key: "card_front", label: "Card Front", hint: "Full front of the raw card, centered" },
    { key: "card_back", label: "Card Back", hint: "Full back of the card" },
    { key: "corner_closeup", label: "Corner Close-up", hint: "Close-up of the sharpest corner, checking for wear" },
    { key: "surface_closeup", label: "Surface Close-up", hint: "Angled close-up checking for scratches or print lines" },
  ],
  SPORTS_CARD: [
    { key: "card_front", label: "Card Front", hint: "Full front of the raw card, centered" },
    { key: "card_back", label: "Card Back", hint: "Full back of the card" },
    { key: "corner_closeup", label: "Corner Close-up", hint: "Close-up of the sharpest corner, checking for wear" },
    { key: "surface_closeup", label: "Surface Close-up", hint: "Angled close-up checking for scratches or print lines" },
  ],
  COMIC: [
    { key: "cover_front", label: "Cover Front", hint: "Full front cover, ungraded" },
    { key: "cover_back", label: "Cover Back", hint: "Full back cover" },
    { key: "spine_closeup", label: "Spine Close-up", hint: "Close-up of the spine, checking for creases" },
    { key: "corner_closeup", label: "Corner Close-up", hint: "Close-up of a corner, checking for wear" },
  ],
};

export function getVerificationChecklist(category: AssetCategory, raw = false): VerificationView[] {
  return raw ? RAW_VERIFICATION_CHECKLIST[category] : GRADED_VERIFICATION_CHECKLIST[category];
}
