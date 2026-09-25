import type { AssetCategory, CardGame, GradingCompany, MarketStatus } from "@prisma/client";

export interface AssetSummary {
  id: string;
  name: string;
  subtitle: string;
  category: AssetCategory;
  game: CardGame;
  gradingCompany: GradingCompany;
  grade: number | null;
  /** BGS Black Label only — see prisma/schema.prisma Asset.isBlackLabel. */
  isBlackLabel: boolean;
  serial: string;
  themeIndex: number;
  priceThb: number | null;
  /** Direction of the latest listed price compared with the previous snapshot. */
  priceDirection?: "up" | "down" | null;
  forSale: boolean;
  vaulted: boolean;
  marketStatus: MarketStatus;
  /** Real SPL mint address for this digital twin, or null for a legacy/simulated-only asset. */
  mintAddress: string | null;
  /** Whether the owner has a live delegate approval on file — see confirmListingApproval / lib/actions.ts::transferOwnership. */
  transferApproved: boolean;
  seller: { id: string; name: string | null };
  owner: { id: string; name: string | null };
  /** Official catalogue image of the card (reference only) — see lib/card-image.ts. */
  catalogImageUrl: string | null;
  /** Real live-camera captures from verification — shown instead of the generated digital-twin art when available. */
  verificationPhotos: { id: string; viewLabel: string; url: string }[];
}

export interface MarketplaceFilterState {
  q: string;
  games: CardGame[];
  gradingCompanies: GradingCompany[];
  grades: number[];
  /** BGS Black Label only — a separate toggle since it's not a distinct numeric grade (see Asset.isBlackLabel). */
  blackLabelOnly: boolean;
  priceMin: number | null;
  priceMax: number | null;
  vaultedStatus: "ALL" | "IN_VAULT" | "SHIPPING";
}

export const EMPTY_FILTERS: MarketplaceFilterState = {
  q: "",
  games: [],
  gradingCompanies: [],
  grades: [],
  blackLabelOnly: false,
  priceMin: null,
  priceMax: null,
  vaultedStatus: "ALL",
};
