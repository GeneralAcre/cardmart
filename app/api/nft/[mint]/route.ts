import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { NFT_SYMBOL } from "@/lib/web3/token-metadata";

/**
 * Public Metaplex metadata JSON for a digital twin — the URI each twin's
 * on-chain metadata points at (lib/web3/token-metadata.ts). Wallets and NFT
 * marketplaces read this to show the card's name, picture and grade. Only
 * catalogue images and the card-front photo are exposed, never the other
 * verification views.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ mint: string }> }) {
  const { mint } = await params;
  const asset = await prisma.asset.findFirst({
    where: { mintAddress: mint },
    select: {
      id: true,
      name: true,
      subtitle: true,
      game: true,
      gradingCompany: true,
      grade: true,
      isBlackLabel: true,
      serial: true,
      cardNumber: true,
      catalogImageUrl: true,
      redeemedAt: true,
      verificationPhotos: { where: { viewKey: { in: ["card_front", "slab_front", "front"] } }, select: { url: true }, take: 1 },
    },
  });
  if (!asset) return NextResponse.json({ error: "Unknown digital twin." }, { status: 404 });

  const host = process.env.MAIN_HOST ?? process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const site = host ? `https://${host}` : new URL(_request.url).origin;
  const graded = asset.gradingCompany !== "RAW" && asset.grade != null;
  const gradeText = graded ? `${asset.gradingCompany} ${asset.grade}${asset.isBlackLabel ? " Black Label" : ""}` : "Raw";
  const image = asset.catalogImageUrl ?? asset.verificationPhotos[0]?.url ?? `${site}/favicon.ico`;

  const attributes = [
    { trait_type: "Game", value: asset.game === "ONE_PIECE" ? "One Piece" : "Pokémon" },
    { trait_type: "Set", value: asset.subtitle },
    ...(asset.cardNumber ? [{ trait_type: "Card number", value: asset.cardNumber }] : []),
    { trait_type: "Grader", value: graded ? asset.gradingCompany : "Ungraded" },
    ...(graded ? [{ trait_type: "Grade", value: String(asset.grade) }] : []),
    ...(asset.isBlackLabel ? [{ trait_type: "Black Label", value: "Yes" }] : []),
    ...(graded ? [{ trait_type: "Cert", value: asset.serial }] : []),
    { trait_type: "Status", value: asset.redeemedAt ? "Redeemed" : "Backed by the physical card" },
  ];

  return NextResponse.json(
    {
      name: `${gradeText} · ${asset.name}`,
      symbol: NFT_SYMBOL,
      description: `${asset.name} (${asset.subtitle}), ${gradeText}. Digital twin of a physical card held and inspected by CardMart. Owning this token is owning the card.`,
      image,
      external_url: `${site}/item/${asset.id}`,
      attributes,
      properties: { category: "image", files: [{ uri: image, type: image.endsWith(".png") ? "image/png" : "image/jpeg" }] },
    },
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } },
  );
}
