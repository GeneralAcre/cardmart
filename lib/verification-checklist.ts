import type { AssetCategory } from "@prisma/client";

export interface VerificationView {
  key: string;
  label: string;
  hint: string;
}

/**
 * Required live-camera capture points per item type. Every view must be
 * captured live (no gallery uploads) before a Self-Mint listing can be
 * created — this is the actual proof of physical possession that replaces
 * a simple photo upload, which anyone could screenshot or reuse.
 */
export const VERIFICATION_CHECKLIST: Record<AssetCategory, VerificationView[]> = {
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
  AMULET: [
    { key: "amulet_front", label: "Amulet Front", hint: "Full front of the sealed case" },
    { key: "amulet_back", label: "Amulet Back", hint: "Full back of the sealed case" },
    { key: "cert_label", label: "Certification Label", hint: "Close-up of the certificate sticker and serial number" },
    { key: "seal_edge", label: "Case Seal Edge", hint: "Close-up of the seal edge, confirming it's untampered" },
  ],
  COMIC: [
    { key: "slab_front", label: "Slab Front", hint: "Full front cover through the case" },
    { key: "slab_back", label: "Slab Back", hint: "Full back of the case" },
    { key: "cert_label", label: "Certification Label", hint: "Close-up of the serial number and grade sticker" },
    { key: "spine_closeup", label: "Spine Close-up", hint: "Close-up of the spine through the case" },
  ],
};

export function getVerificationChecklist(category: AssetCategory): VerificationView[] {
  return VERIFICATION_CHECKLIST[category];
}
