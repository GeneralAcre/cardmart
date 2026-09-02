import { NextResponse, type NextRequest } from "next/server";
import type { GradingCompany } from "@prisma/client";

import { getMarketplaceListings } from "@/lib/queries";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  const gradingCompanies = sp.getAll("gradingCompany") as GradingCompany[];
  const grades = sp
    .getAll("grade")
    .map(Number)
    .filter((n) => !Number.isNaN(n));
  const priceMin = sp.has("priceMin") ? Number(sp.get("priceMin")) : undefined;
  const priceMax = sp.has("priceMax") ? Number(sp.get("priceMax")) : undefined;
  const vaultedStatus = (sp.get("vaultedStatus") as "ALL" | "IN_VAULT" | "SHIPPING" | null) ?? "ALL";
  const q = sp.get("q") ?? undefined;

  const listings = await getMarketplaceListings({
    q,
    gradingCompanies: gradingCompanies.length ? gradingCompanies : undefined,
    grades: grades.length ? grades : undefined,
    priceMin,
    priceMax,
    vaultedStatus,
  });

  return NextResponse.json({ listings });
}
