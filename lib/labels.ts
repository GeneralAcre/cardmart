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
  AMULET: "Certified Amulet",
  COMIC: "Graded Comic",
};

export const GRADING_COMPANY_LABELS: Record<GradingCompany, string> = {
  PSA: "PSA",
  BGS: "BGS",
  CGC: "CGC",
};

export const MARKET_STATUS_LABELS: Record<MarketStatus, string> = {
  READY_TO_SHIP: "Ready to Ship",
  IN_VAULT: "In Vault",
  IN_ESCROW: "In Escrow",
  DELISTED: "Not Listed",
};

export const MARKET_STATUS_BADGE_CLASS: Record<MarketStatus, string> = {
  READY_TO_SHIP: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  IN_VAULT: "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300",
  IN_ESCROW: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  DELISTED: "bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-400",
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
  LOCKED: "Locked in Escrow",
  RELEASED: "Released to Seller",
  REFUNDED: "Refunded to Buyer",
};

export const VERIFICATION_PACKAGE_LABELS: Record<VerificationPackage, string> = {
  SELF_MINT: "Self-Mint",
  FULL_SERVICE: "Full-Service Grading",
};

export const VERIFICATION_PACKAGE_BADGE_CLASS: Record<VerificationPackage, string> = {
  SELF_MINT: "bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300",
  FULL_SERVICE: "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300",
};

export const GRADING_SUBMISSION_STATUS_LABELS: Record<GradingSubmissionStatus, string> = {
  AWAITING_SHIPMENT_TO_GRADER: "Awaiting Shipment to Grading Co.",
  AT_GRADING_COMPANY: "At Grading Company",
  GRADED: "Graded & Minted",
  REJECTED: "Rejected",
};

export const PROVENANCE_LABELS: Record<ProvenanceType, string> = {
  MINTED_DIGITAL_TWIN: "Digital Twin Minted",
  LISTED: "Listed for Sale",
  DELISTED: "Delisted",
  ESCROW_LOCKED: "Payment Locked in Escrow",
  SHIPPED_TO_WAREHOUSE: "Shipped to Warehouse",
  INSPECTION_PASSED: "Inspection Passed",
  INSPECTION_REJECTED: "Inspection Rejected",
  DEPOSITED_TO_VAULT: "Deposited to Vault",
  DELIVERED_TO_BUYER: "Delivered to Buyer",
  OWNERSHIP_TRANSFERRED: "Digital Ownership Transferred",
  RELISTED: "Relisted for Instant Sale",
  REDEEMED: "Physical Item Redeemed",
  ESCROW_REFUNDED: "Escrow Refunded",
};
