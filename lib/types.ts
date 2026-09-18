import type { AssetCategory, GradingCompany, MarketStatus } from "@prisma/client";

export interface AssetSummary {
  id: string;
  name: string;
  subtitle: string;
  category: AssetCategory;
  gradingCompany: GradingCompany;
  grade: number | null;
  serial: string;
  themeIndex: number;
  priceThb: number | null;
  forSale: boolean;
  vaulted: boolean;
  marketStatus: MarketStatus;
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
