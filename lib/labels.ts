import type {
  AssetCategory,
  GradingCompany,
  MarketStatus,
  PipelineStage,
  InboundStatus,
  EscrowStatus,
  ProvenanceType,
  VerificationPackage,
  GradingSubmissionStatus,
} from "@prisma/client";

export const CATEGORY_LABELS: Record<AssetCategory, string> = {
  TRADING_CARD: "Trading Card",
  SPORTS_CARD: "Sports Card",
  COMIC: "Graded Comic",
};

export const GRADING_COMPANY_LABELS: Record<GradingCompany, string> = {
  PSA: "PSA",
  BGS: "BGS",
  CGC: "CGC",
  RAW: "Raw / Ungraded",
};

// Which grading institutes are actually relevant to each category — PSA/BGS
// grade cards, CGC grades comics (and cards).
export const CATEGORY_GRADING_COMPANIES: Record<AssetCategory, GradingCompany[]> = {
  TRADING_CARD: ["PSA", "BGS", "CGC"],
  SPORTS_CARD: ["PSA", "BGS"],
  COMIC: ["CGC"],
};

// Each institute's own name for its top numeric grades — shown as a hint
// next to the raw number wherever a grade is entered or displayed, not
// meant to be exhaustive down to the bottom of the scale. BGS's Black
// Label is deliberately left out here: it shares grade 10 with a regular
// Pristine 10, so it can't be looked up by grade alone — see
// Asset.isBlackLabel and gradeTierLabel below.
export const GRADE_TIER_LABELS: Partial<Record<GradingCompany, { grade: number; label: string }[]>> = {
  BGS: [
    { grade: 10, label: "Pristine 10" },
    { grade: 9.5, label: "Gem Mint 9.5" },
    { grade: 9, label: "Mint 9" },
  ],
  PSA: [
    { grade: 10, label: "Gem Mint 10" },
    { grade: 9, label: "Mint 9" },
    { grade: 8, label: "Near Mint-Mint 8" },
  ],
  CGC: [
    { grade: 10, label: "Pristine 10" },
    { grade: 9.5, label: "Gem Mint 9.5" },
    { grade: 9, label: "Mint 9" },
  ],
};

/** The only grade BGS's Black Label designation ever applies to. */
export const BGS_BLACK_LABEL_GRADE = 10;

/** The named rank for a company + numeric grade (+ Black Label), or null when it's outside the known top tiers. */
export function gradeTierLabel(
  company: GradingCompany,
  grade: number | null,
  isBlackLabel = false,
): string | null {
  if (grade == null) return null;
  if (company === "BGS" && grade === BGS_BLACK_LABEL_GRADE && isBlackLabel) {
    return "Pristine 10 (Black Label)";
  }
  return GRADE_TIER_LABELS[company]?.find((t) => t.grade === grade)?.label ?? null;
}

export const MARKET_STATUS_LABELS: Record<MarketStatus, string> = {
  READY_TO_SHIP: "Ready to Ship",
  IN_VAULT: "In Vault",
  IN_ESCROW: "Sale Pending",
  DELISTED: "Not Listed",
};

// Status is encoded by weight (solid / outline / muted / faint), not hue —
// keeps the marketplace to a cream/white/black palette.
export const MARKET_STATUS_BADGE_CLASS: Record<MarketStatus, string> = {
  READY_TO_SHIP: "bg-foreground text-background",
  IN_VAULT: "border border-foreground/50 text-foreground bg-transparent",
  IN_ESCROW: "bg-muted text-foreground/80",
  DELISTED: "border border-dashed border-muted-foreground/30 text-muted-foreground bg-transparent",
};

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  NONE: "—",
  AWAITING_SELLER_SHIPMENT: "Awaiting Seller Shipment",
  IN_TRANSIT_TO_WAREHOUSE: "In Transit to Warehouse",
  IN_INSPECTION: "In Inspection",
  REJECTED: "Rejected",
  IN_TRANSIT_TO_BUYER: "In Transit to Buyer",
  DELIVERED: "Delivered",
};

export const INBOUND_STATUS_LABELS: Record<InboundStatus, string> = {
  PENDING_INSPECTION: "Pending Inspection",
  APPROVED_SHIP: "Approved — Ship to Buyer",
  APPROVED_VAULT: "Approved — Deposited to Vault",
  REJECTED: "Rejected",
};

export const ESCROW_STATUS_LABELS: Record<EscrowStatus, string> = {
  LOCKED: "Payment Held",
  RELEASED: "Paid to Seller",
  REFUNDED: "Refunded to Buyer",
};

export const VERIFICATION_PACKAGE_LABELS: Record<VerificationPackage, string> = {
  SELF_MINT: "Instant Verify",
  FULL_SERVICE: "Full-Service Grading",
};

export const VERIFICATION_PACKAGE_BADGE_CLASS: Record<VerificationPackage, string> = {
  SELF_MINT: "bg-muted text-muted-foreground",
  FULL_SERVICE: "border border-foreground/50 text-foreground bg-transparent",
};

export const GRADING_SUBMISSION_STATUS_LABELS: Record<GradingSubmissionStatus, string> = {
  AWAITING_SHIPMENT_TO_GRADER: "Awaiting Shipment to Grading Co.",
  AT_GRADING_COMPANY: "At Grading Company",
  GRADED: "Graded & Minted",
  REJECTED: "Rejected",
};

export const PROVENANCE_LABELS: Record<ProvenanceType, string> = {
  MINTED_DIGITAL_TWIN: "Digital Certificate Created",
  LISTED: "Listed for Sale",
  DELISTED: "Delisted",
  ESCROW_LOCKED: "Payment Held Safely",
  SHIPPED_TO_WAREHOUSE: "Shipped to Warehouse",
  INSPECTION_PASSED: "Inspection Passed",
  INSPECTION_REJECTED: "Inspection Rejected",
  DEPOSITED_TO_VAULT: "Deposited to Vault",
  DELIVERED_TO_BUYER: "Delivered to Buyer",
  OWNERSHIP_TRANSFERRED: "Ownership Transferred",
  RELISTED: "Relisted for Instant Sale",
  REDEEMED: "Physical Item Redeemed",
  ESCROW_REFUNDED: "Payment Refunded",
  LISTING_APPROVED: "Transfer Approved",
};
