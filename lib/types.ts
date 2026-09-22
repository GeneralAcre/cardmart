import type { AssetCategory, GradingCompany, MarketStatus } from "@prisma/client";

export interface AssetSummary {
  id: string;
  name: string;
  subtitle: string;
  category: AssetCategory;
  gradingCompany: GradingCompany;
  grade: number | null;
  /** BGS Black Label only — see prisma/schema.prisma Asset.isBlackLabel. */
  isBlackLabel: boolean;
  serial: string;
  themeIndex: number;
  priceThb: number | null;
  forSale: boolean;
  vaulted: boolean;
  marketStatus: MarketStatus;
  /** Real SPL mint address for this digital twin, or null for a legacy/simulated-only asset. */
  mintAddress: string | null;
  /** Whether the owner has a live delegate approval on file — see confirmListingApproval / lib/actions.ts::transferOwnership. */
  transferApproved: boolean;
  seller: { id: string; name: string | null };
  owner: { id: string; name: string | null };
  /** Real live-camera captures from verification — shown instead of the generated digital-twin art when available. */
  verificationPhotos: { id: string; viewLabel: string; url: string }[];
}

export interface MarketplaceFilterState {
  q: string;
  categories: AssetCategory[];
  gradingCompanies: GradingCompany[];
  grades: number[];
  priceMin: number | null;
  priceMax: number | null;
  vaultedStatus: "ALL" | "IN_VAULT" | "SHIPPING";
}

export const EMPTY_FILTERS: MarketplaceFilterState = {
  q: "",
  categories: [],
  gradingCompanies: [],
  grades: [],
  priceMin: null,
  priceMax: null,
  vaultedStatus: "ALL",
};
