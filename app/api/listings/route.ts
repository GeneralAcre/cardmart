import { NextResponse, type NextRequest } from "next/server";
import { GradingCompany, type CardGame, type CardLanguage } from "@prisma/client";

import { isRarity } from "@/lib/rarity";

import { getMarketplaceListings } from "@/lib/queries";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  const games = sp.getAll("game").filter((g): g is CardGame => g === "POKEMON" || g === "ONE_PIECE");
  const languages = sp
    .getAll("language")
    .filter((l): l is CardLanguage => l === "ENGLISH" || l === "JAPANESE");
  const rarities = sp.getAll("rarity").filter(isRarity);
  // Capped so one request can't send an unbounded IN list.
  const sets = sp.getAll("set").filter(Boolean).slice(0, 50);
  const gradingCompanies = sp
    .getAll("gradingCompany")
    .filter((c): c is GradingCompany => (Object.values(GradingCompany) as string[]).includes(c));
  const grades = sp
    .getAll("grade")
    .map(Number)
    .filter((n) => !Number.isNaN(n));
  const blackLabelOnly = sp.get("blackLabel") === "true";
  const finiteOrUndefined = (key: string) => {
    const n = sp.has(key) ? Number(sp.get(key)) : NaN;
    return Number.isFinite(n) ? n : undefined;
  };
  const priceMin = finiteOrUndefined("priceMin");
  const priceMax = finiteOrUndefined("priceMax");
  const vaultedParam = sp.get("vaultedStatus");
  const vaultedStatus = vaultedParam === "IN_VAULT" || vaultedParam === "SHIPPING" ? vaultedParam : "ALL";
  const q = sp.get("q") ?? undefined;

  const listings = await getMarketplaceListings({
    q,
    games: games.length ? games : undefined,
    languages: languages.length ? languages : undefined,
    rarities: rarities.length ? rarities : undefined,
    sets: sets.length ? sets : undefined,
    gradingCompanies: gradingCompanies.length ? gradingCompanies : undefined,
    grades: grades.length ? grades : undefined,
    blackLabelOnly,
    priceMin,
    priceMax,
    vaultedStatus,
  });

  return NextResponse.json({ listings });
}
