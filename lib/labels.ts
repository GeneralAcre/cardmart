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
};
