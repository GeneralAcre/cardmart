import { NextResponse, type NextRequest } from "next/server";
import type { CardGame, GradingCompany } from "@prisma/client";

import { getMarketplaceListings } from "@/lib/queries";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  const games = sp.getAll("game").filter((g): g is CardGame => g === "POKEMON" || g === "ONE_PIECE");
  const gradingCompanies = sp.getAll("gradingCompany") as GradingCompany[];
  const grades = sp
    .getAll("grade")
    .map(Number)
    .filter((n) => !Number.isNaN(n));
  const blackLabelOnly = sp.get("blackLabel") === "true";
  const priceMin = sp.has("priceMin") ? Number(sp.get("priceMin")) : undefined;
  const priceMax = sp.has("priceMax") ? Number(sp.get("priceMax")) : undefined;
  const vaultedStatus = (sp.get("vaultedStatus") as "ALL" | "IN_VAULT" | "SHIPPING" | null) ?? "ALL";
  const q = sp.get("q") ?? undefined;

  const listings = await getMarketplaceListings({
    q,
    games: games.length ? games : undefined,
    gradingCompanies: gradingCompanies.length ? gradingCompanies : undefined,
    grades: grades.length ? grades : undefined,
    blackLabelOnly,
    priceMin,
    priceMax,
    vaultedStatus,
  });

  return NextResponse.json({ listings });
}
