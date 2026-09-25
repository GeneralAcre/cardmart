"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { AssetCategory, GradingCompany, KycIdType, NotificationType, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireAdmin } from "@/lib/session";
import {
  mockMintDigitalTwin,
  mockTransferOwnership,
  mockEscrowInstruction,
} from "@/lib/web3/mock-chain";
import { releaseTradeToSeller, refundTradeToBuyer, getEscrowAuthorityAddress } from "@/lib/web3/escrow-server";
import { isDigitalTwinHeldBy, mintDigitalTwinToken, transferDigitalTwinToken } from "@/lib/web3/token-server";
import { FULL_SERVICE_PACKAGE_PRICE_THB } from "@/lib/pricing";
import { themeIndexForSerial } from "@/lib/theme";
import { getVerificationChecklist } from "@/lib/verification-checklist";
import { BGS_BLACK_LABEL_GRADE, gradeTierLabel } from "@/lib/labels";
import { requestDevnetAirdrop } from "@/lib/solana";
import { checkAllIntegrations } from "@/lib/integrations";
import { getPortfolioPriceHistory, getPriceHistory, type PriceHistoryRange } from "@/lib/queries";
import {
  extractPsaCertNumber,
  isPsaConfigured,
  lookupPsaCert,
  lookupPsaPopulation,
  verifyPsaCert,
  type PsaCertData,
} from "@/lib/psa";

function revalidateMarketplace(assetId?: string) {
  revalidatePath("/marketplace");
  revalidatePath("/portfolio");
  revalidatePath("/admin/warehouse");
  if (assetId) revalidatePath(`/item/${assetId}`);
}

// Real notifications only, fired at the moment something real actually
// happens elsewhere in this file (an item sold, a grade came back, etc.) —
// never backfilled or synthesized after the fact. notifyUser is for a
// specific buyer/seller; notifyAdmins broadcasts to every isAdmin user by
// leaving userId unset, since staff alerts aren't addressed to one person.
async function notifyUser(userId: string, type: NotificationType, title: string, body: string, href?: string) {
  await prisma.notification.create({
    data: { audience: "USER", userId, type, title, body, href },
  });
}

async function notifyAdmins(type: NotificationType, title: string, body: string, href?: string) {
  await prisma.notification.create({
    data: { audience: "ADMIN", type, title, body, href },
  });
}

/** Notifies everyone watching an asset when its price genuinely drops (never on a price increase or first listing). */
async function notifyWatchersOfPriceDrop(assetId: string, assetName: string, oldPriceThb: number, newPriceThb: number) {
  if (newPriceThb >= oldPriceThb) return;
  const watchers = await prisma.watchlistItem.findMany({ where: { assetId }, select: { userId: true } });
  await Promise.all(
    watchers.map((w) =>
      notifyUser(
        w.userId,
        "PRICE_DROP_WATCHED",
        "Price drop on an item you're watching",
        `${assetName} dropped from ${oldPriceThb.toLocaleString()} to ${newPriceThb.toLocaleString()} THB.`,
        `/item/${assetId}`,
      ),
    ),
  );
}

/**
 * "Where to buy" alerts: tells everyone with a matching WantedCard that a card
 * they're looking for was just listed. Runs on every new listing and relist,
 * never on a plain reprice upward. trustedOnly alerts only fire for sellers
 * with a verified identity or at least a 4-star average from real reviews.
 * One notification per user per listing, even if several of their alerts match.
 */
async function notifyWantedCardMatches(assetId: string) {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: { owner: { select: { id: true, name: true, handle: true, kycStatus: true } } },
  });
  if (!asset || !asset.forSale || asset.priceThb == null || asset.redeemedAt) return;
  const priceThb = asset.priceThb;

  const alerts = await prisma.wantedCard.findMany({ where: { userId: { not: asset.ownerId } } });
  const name = asset.name.toLowerCase();
  const matches = alerts.filter(
    (w) =>
      name.includes(w.query.toLowerCase()) &&
      (w.gradingCompany == null || w.gradingCompany === asset.gradingCompany) &&
      (w.minGrade == null || (asset.grade != null && asset.grade >= w.minGrade)) &&
      (!w.blackLabelOnly || asset.isBlackLabel) &&
      (w.maxPriceThb == null || priceThb <= w.maxPriceThb),
  );
  if (matches.length === 0) return;

  let sellerTrusted = asset.owner.kycStatus === "VERIFIED";
  if (!sellerTrusted && matches.some((w) => w.trustedOnly)) {
    const rating = await prisma.review.aggregate({ where: { sellerId: asset.ownerId }, _avg: { rating: true } });
    sellerTrusted = (rating._avg.rating ?? 0) >= 4;
  }

  const notified = new Set<string>();
  const matchedIds: string[] = [];
  for (const w of matches) {
    if (w.trustedOnly && !sellerTrusted) continue;
    matchedIds.push(w.id);
    if (notified.has(w.userId)) continue;
    notified.add(w.userId);
    await notifyUser(
      w.userId,
      "WANTED_CARD_LISTED",
      "A card you want was just listed",
      `${asset.name} is now for sale at ${priceThb.toLocaleString()} THB from ${asset.owner.name ?? asset.owner.handle ?? "a seller"}${sellerTrusted ? " (trusted seller)" : ""}.`,
      `/item/${asset.id}`,
    );
  }
  if (matchedIds.length > 0) {
    await prisma.wantedCard.updateMany({ where: { id: { in: matchedIds } }, data: { lastMatchedAt: new Date() } });
  }
}

/**
 * Closes every still-pending card swap that involves this asset, refunding any
 * cash the proposer locked. Called whenever the asset stops being swappable
 * (sold, auctioned, redeemed, or swapped in a different trade), so a stale
 * proposal can never be accepted and locked cash never gets stranded.
 */
async function cancelTradesInvolving(assetId: string, exceptTradeId?: string) {
  const trades = await prisma.tradeOffer.findMany({
    where: {
      status: "PENDING",
      OR: [{ requestedAssetId: assetId }, { offeredAssetId: assetId }],
      ...(exceptTradeId ? { id: { not: exceptTradeId } } : {}),
    },
    include: { proposer: true, recipient: true, requestedAsset: true },
  });
  for (const trade of trades) {
    await refundTradeCash(trade);
    await prisma.tradeOffer.update({ where: { id: trade.id }, data: { status: "CANCELLED", respondedAt: new Date() } });
    await notifyUser(
      trade.proposerId,
      "TRADE_OFFER_REJECTED",
      "Swap proposal closed",
      `Your swap for ${trade.requestedAsset.name} was closed because one of the cards is no longer available${trade.cashThb > 0 ? " — your cash was refunded" : ""}.`,
      "/portfolio?tab=trades",
    );
  }
}

/** Refunds a proposer's locked swap cash (cashThb > 0 only; a no-op otherwise). */
async function refundTradeCash(trade: {
  cashThb: number;
  cashOnChain: boolean;
  cashTradeId: bigint | null;
  requestedAssetId: string;
  proposer: { walletAddress: string | null };
  recipient: { walletAddress: string | null };
}) {
  if (trade.cashThb <= 0) return;
  await releaseOrRefundEscrow(
    "refund",
    {
      onChain: trade.cashOnChain,
      onChainTradeId: trade.cashTradeId,
      buyer: { walletAddress: trade.proposer.walletAddress },
      seller: { walletAddress: trade.recipient.walletAddress },
    },
    trade.requestedAssetId,
  );
}

const verificationPhotoSchema = z.object({
  viewKey: z.string().min(1),
  viewLabel: z.string().min(1),
  url: z.string().url(),
});

const createListingSchema = z
  .object({
    name: z.string().min(2),
    subtitle: z.string().min(2),
    category: z.enum(["TRADING_CARD", "SPORTS_CARD", "COMIC"]),
    raw: z.enum(["true", "false"]).transform((v) => v === "true"),
    gradingCompany: z.enum(["PSA", "BGS", "CGC", "RAW"]),
    grade: z.coerce.number().min(1).max(10).optional(),
    // Only meaningful for a BGS grade-10 cert — guarded again below so a
    // tampered form field can't mislabel any other company/grade.
    isBlackLabel: z
      .enum(["true", "false"])
      .optional()
      .transform((v) => v === "true"),
    serial: z.string().min(4).optional(),
    priceThb: z.coerce.number().int().min(100),
    photos: z.string().transform((raw, ctx) => {
      try {
        return z.array(verificationPhotoSchema).parse(JSON.parse(raw));
      } catch {
        ctx.addIssue({ code: "custom", message: "Invalid verification photo data." });
        return z.NEVER;
      }
    }),
  })
  .superRefine((data, ctx) => {
    if (!data.raw) {
      if (data.grade == null) ctx.addIssue({ code: "custom", message: "Enter a grade." });
      if (!data.serial) ctx.addIssue({ code: "custom", message: "Enter a serial number." });
    }
  });

function generateRawSerial(): string {
  return `RAW-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export interface CreateListingState {
  error?: string;
  assetId?: string;
  // Set only when a real digital-twin token was actually minted — the
  // client uses this to immediately follow up with an owner-signed Approve
  // (see components/listing/self-mint-form.tsx + confirmListingApproval
  // below), which is what actually makes a future sale's transfer real.
  mintAddress?: string;
}

export interface PsaCertLookupResult {
  status: "ok" | "not_found" | "unavailable";
  cert?: PsaCertData;
  population?: { description: string | null; total: number | null; grade10: number | null } | null;
}

/**
 * Live PSA lookup as the seller types a cert number into the self-mint
 * form, so they see (and the form can pre-fill from) real PSA data before
 * ever submitting — not just a pass/fail check at final submit time like
 * createListing's own PSA check.
 */
export async function lookupPsaCertForForm(rawSerial: string): Promise<PsaCertLookupResult> {
  await getCurrentUser();

  const certNumber = extractPsaCertNumber(rawSerial.trim());
  if (!certNumber) return { status: "not_found" };

  const result = await verifyPsaCert(certNumber);
  if (!result.ok) return { status: result.reason };

  const population = result.cert.specId != null ? await lookupPsaPopulation(result.cert.specId) : null;
  return { status: "ok", cert: result.cert, population };
}

/**
 * Registers a new digital twin for an already-graded item and lists it for
 * sale. The seller self-declares the certificate details and must supply a
 * live camera capture for every required checklist view (see
 * lib/verification-checklist.ts) — this is the actual proof of possession,
 * checked again here since client-side gating alone can't be trusted.
 */
export async function createListing(
  _prev: CreateListingState,
  formData: FormData,
): Promise<CreateListingState> {
  const user = await getCurrentUser();
  if (user.isBanned) return { error: "Your account is suspended and can't create new listings." };
  const parsed = createListingSchema.safeParse({
    name: formData.get("name"),
    subtitle: formData.get("subtitle"),
    category: formData.get("category"),
    raw: formData.get("raw"),
    gradingCompany: formData.get("gradingCompany"),
    grade: formData.get("grade") || undefined,
    isBlackLabel: formData.get("isBlackLabel") || undefined,
    serial: formData.get("serial") || undefined,
    priceThb: formData.get("priceThb"),
    photos: formData.get("photos"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid listing details." };
  }
  const data = parsed.data;
  const serial = data.raw ? generateRawSerial() : data.serial!;

  const requiredViews = getVerificationChecklist(data.category as AssetCategory, data.raw);
  const capturedKeys = new Set(data.photos.map((p) => p.viewKey));
  const missing = requiredViews.filter((v) => !capturedKeys.has(v.key));
  if (missing.length > 0) {
    return {
      error: `Live-capture every required view before creating the listing (missing: ${missing.map((v) => v.label).join(", ")}).`,
    };
  }

  if (!data.raw) {
    const existing = await prisma.asset.findUnique({ where: { serial } });
    if (existing) {
      await notifyAdmins(
        "DUPLICATE_CERT_ATTEMPT",
        "Duplicate certificate submission",
        `${user.name ?? user.handle ?? "A user"} tried to list "${data.name}" using certificate ${serial}, which is already registered to another item.`,
        `/item/${existing.id}`,
      );
      return { error: `Serial ${serial} is already registered on the platform.` };
    }
  }

  // Real-time check against PSA's actual cert database — a no-op until
  // PSA_API_TOKEN is configured (see lib/psa.ts). Only blocks the listing on
  // a definitive "not_found" or a grade mismatch; "unavailable" (no token,
  // PSA account not yet approved for live access, network hiccup) is not
  // proof the cert is fake, so it's allowed through same as unconfigured.
  if (!data.raw && data.gradingCompany === "PSA" && isPsaConfigured()) {
    const result = await verifyPsaCert(extractPsaCertNumber(serial));
    if (!result.ok && result.reason === "not_found") {
      return { error: `PSA cert ${serial} could not be verified. Double-check the cert number.` };
    }
    if (result.ok && result.cert.gradeNumber != null && result.cert.gradeNumber !== data.grade) {
      return {
        error: `PSA's records show cert ${serial} as a ${result.cert.cardGrade}, not the grade ${data.grade} you entered.`,
      };
    }
  }

  // Real, server-signed mint (a genuine SPL Token, decimals 0, fixed supply
  // of 1 — see lib/web3/token-server.ts) whenever the escrow/platform
  // authority is configured and the seller has a real wallet on file;
  // otherwise falls back to the old fully-simulated mint, same
  // degrade-gracefully pattern used everywhere else real signing is
  // optional. No client wallet interaction needed for minting itself
  // anymore — the seller signs afterward, once, to approve a future
  // transfer (see confirmListingApproval + self-mint-form.tsx).
  const authorityAddress = await getEscrowAuthorityAddress();
  let mintTxSignature: string;
  let isOnChain: boolean;
  let mintAddress: string | null = null;
  if (authorityAddress && user.walletAddress) {
    const minted = await mintDigitalTwinToken({ ownerAddress: user.walletAddress });
    mintTxSignature = minted.txSignature;
    mintAddress = minted.mintAddress;
    isOnChain = true;
  } else {
    mintTxSignature = (await mockMintDigitalTwin(serial)).txSignature;
    isOnChain = false;
  }

  const isBlackLabel =
    !data.raw && data.gradingCompany === "BGS" && data.grade === BGS_BLACK_LABEL_GRADE && Boolean(data.isBlackLabel);

  const asset = await prisma.asset.create({
    data: {
      name: data.name,
      subtitle: data.subtitle,
      category: data.category as AssetCategory,
      gradingCompany: data.gradingCompany as GradingCompany,
      grade: data.raw ? null : data.grade,
      isBlackLabel,
      serial,
      themeIndex: themeIndexForSerial(serial),
      priceThb: data.priceThb,
      forSale: true,
      vaulted: false,
      marketStatus: "READY_TO_SHIP",
      pipelineStage: "NONE",
      mockMintTx: mintTxSignature,
      mintAddress,
      verificationPackage: "SELF_MINT",
      mintFeeThb: 0,
      sellerId: user.id,
      ownerId: user.id,
      verificationPhotos: {
        createMany: {
          data: data.photos.map((p) => ({
            viewKey: p.viewKey,
            viewLabel: p.viewLabel,
            url: p.url,
          })),
        },
      },
      priceSnapshots: { create: { priceThb: data.priceThb } },
    },
  });

  await prisma.provenanceEvent.createMany({
    data: [
      {
        assetId: asset.id,
        type: "MINTED_DIGITAL_TWIN",
        note: data.raw
          ? `Seller listing: raw/ungraded item documented with ${data.photos.length} live camera captures — no grading company involved.`
          : `Seller listing: documented with ${data.photos.length} live camera captures and registered as ${data.gradingCompany} certificate ${serial}.`,
        mockTxSignature: mintTxSignature,
        onChain: isOnChain,
        actorId: user.id,
      },
      {
        assetId: asset.id,
        type: "LISTED",
        note: `Listed for sale at ${data.priceThb.toLocaleString()} THB.`,
        mockTxSignature: mintTxSignature,
        onChain: isOnChain,
        actorId: user.id,
      },
    ],
  });

  await notifyWantedCardMatches(asset.id);

  revalidateMarketplace(asset.id);
  return { assetId: asset.id, mintAddress: mintAddress ?? undefined };
}

/**
 * Confirms the seller's post-mint Approve signature (see
 * components/listing/self-mint-form.tsx) — delegates the escrow authority as
 * a spender over the freshly minted token, which is what actually lets a
 * future sale transfer it for real. Best-effort: if this never gets called
 * (signing failed or was skipped), the listing still stands — a future sale
 * just falls back to the simulated transfer, same tolerant pattern used
 * everywhere else real signing is optional.
 */
export async function confirmListingApproval(assetId: string, approveTxSignature: string) {
  const user = await getCurrentUser();
  const asset = await prisma.asset.findUniqueOrThrow({ where: { id: assetId } });
  if (asset.ownerId !== user.id) throw new Error("You do not own this item.");

  await prisma.asset.update({ where: { id: assetId }, data: { transferApproved: true } });
  await prisma.provenanceEvent.create({
    data: {
      assetId,
      type: "LISTING_APPROVED",
      note: "Seller approved the platform to complete a transfer if this item sells.",
      mockTxSignature: approveTxSignature,
      onChain: true,
      actorId: user.id,
    },
  });
  revalidateMarketplace(assetId);
}

/**
 * Shared purchase-completion core for every path that ends with a buyer
 * actually owning the asset at an already-agreed price — the original
 * fixed-price buyListing below, plus the newer claimAuctionWin and
 * completeOfferPurchase, which only differ in how that price was agreed
 * (asking price vs. winning bid vs. accepted offer). Locks escrow, then
 * either transfers instantly (vaulted) or kicks off the ship/inspection
 * pipeline — identical either way regardless of how the sale came about.
 */
async function completePurchase(opts: {
  asset: Prisma.AssetGetPayload<{ include: { owner: true } }>;
  user: Awaited<ReturnType<typeof getCurrentUser>>;
  priceThb: number;
  fulfillmentChoice: "SHIP" | "VAULT";
  escrowLock?: { tradeId: string; txSignature: string; lamports: string; tradeAccount: string };
  soldNote: string;
  purchasedNote: string;
}) {
  const { asset, user, priceThb, fulfillmentChoice, escrowLock, soldNote, purchasedNote } = opts;
  const assetId = asset.id;

  // Real on-chain lock when the buyer actually signed one (see
  // components/item/buy-panel.tsx) — falls back to the old simulated
  // signature otherwise, same pattern as everywhere else real signing was
  // added this session.
  if (asset.redeemedAt) throw new Error("This item was redeemed and is no longer tradeable.");
  const onChain = Boolean(escrowLock);
  const lockSignature = escrowLock?.txSignature ?? (await mockEscrowInstruction("lock", assetId)).txSignature;

  const escrowTx = await prisma.escrowTransaction.create({
    data: {
      assetId,
      buyerId: user.id,
      sellerId: asset.ownerId,
      amountThb: priceThb,
      fulfillmentChoice,
      status: "LOCKED",
      onChain,
      onChainTradeId: escrowLock ? BigInt(escrowLock.tradeId) : null,
      tradeAccount: escrowLock?.tradeAccount ?? null,
      lamportsLocked: escrowLock ? BigInt(escrowLock.lamports) : null,
    },
  });
  await prisma.provenanceEvent.create({
    data: {
      assetId,
      type: "ESCROW_LOCKED",
      note: `Buyer payment of ${priceThb.toLocaleString()} THB locked in escrow.`,
      mockTxSignature: lockSignature,
      onChain,
      actorId: user.id,
    },
  });

  if (asset.vaulted) {
    // Vault Trading Feature: instant digital transfer, zero shipping —
    // funds release the moment the trade happens, so release the real
    // escrow (when one was locked) right here instead of waiting on a
    // separate warehouse step. Reuses releaseOrRefundEscrow so a real
    // on-chain failure throws (and the purchase aborts) rather than
    // silently transferring ownership while real funds stay locked.
    const transfer = await transferOwnership(asset, asset.owner.walletAddress, user.walletAddress, user.id);
    const release = await releaseOrRefundEscrow(
      "release",
      {
        onChain,
        onChainTradeId: escrowLock ? BigInt(escrowLock.tradeId) : null,
        buyer: { walletAddress: user.walletAddress },
        seller: { walletAddress: asset.owner.walletAddress },
      },
      assetId,
    );

    await prisma.asset.update({
      where: { id: assetId },
      data: { ownerId: user.id, forSale: false },
    });
    await prisma.escrowTransaction.update({
      where: { id: escrowTx.id },
      data: { status: "RELEASED", releasedAt: new Date() },
    });
    await prisma.provenanceEvent.create({
      data: {
        assetId,
        type: "OWNERSHIP_TRANSFERRED",
        note: "Instant vault trade: digital ownership transferred and escrow released to seller.",
        mockTxSignature: transfer.signature,
        onChain: transfer.onChain,
        actorId: user.id,
      },
    });
    void release;
    await notifyUser(asset.ownerId, "ITEM_SOLD", "Item sold", soldNote, `/item/${assetId}`);
    await notifyUser(user.id, "ITEM_PURCHASED", "Purchase complete", purchasedNote, `/item/${assetId}`);
  } else {
    await prisma.asset.update({
      where: { id: assetId },
      data: {
        forSale: false,
        marketStatus: "IN_ESCROW",
        pipelineStage: "IN_INSPECTION",
      },
    });
    const shipTx = await mockEscrowInstruction("lock", assetId);
    await prisma.provenanceEvent.create({
      data: {
        assetId,
        type: "SHIPPED_TO_WAREHOUSE",
        note: "Seller shipped package to platform warehouse.",
        mockTxSignature: shipTx.txSignature,
        actorId: asset.sellerId,
      },
    });
    // Real check against PSA's cert database when possible — falls back to
    // mirroring the seller's declared data (the old fully-mocked behavior)
    // if PSA isn't configured or this isn't a PSA item, so nothing breaks
    // before a real PSA_API_TOKEN exists.
    const psaCert =
      asset.gradingCompany === "PSA"
        ? await lookupPsaCert(extractPsaCertNumber(asset.serial))
        : null;

    await prisma.inboundPackage.create({
      data: {
        assetId,
        escrowTxId: escrowTx.id,
        declaredSerial: asset.serial,
        declaredGradingCompany: asset.gradingCompany,
        declaredGrade: asset.grade ?? 0,
        officialSerial: psaCert ? `PSA-${psaCert.certNumber}` : asset.serial,
        officialGradingCompany: asset.gradingCompany,
        officialGrade: psaCert?.gradeNumber ?? asset.grade ?? 0,
        officialName: psaCert?.subject ?? asset.name,
        status: "PENDING_INSPECTION",
      },
    });
    await notifyAdmins(
      "NEW_SUBMISSION",
      "New inbound package",
      `${asset.name} sold for ${priceThb.toLocaleString()} THB and is awaiting warehouse inspection.`,
      `/admin/warehouse`,
    );
    await notifyUser(user.id, "ITEM_PURCHASED", "Purchase confirmed", purchasedNote, `/item/${assetId}`);
  }

  await cancelTradesInvolving(assetId);
  revalidateMarketplace(assetId);
}

/**
 * Buyer purchases a listing with escrow protection. If the item is already
 * in the vault, ownership transfers instantly (no physical movement). If
 * it's still with the seller, it enters the AWAITING_SELLER_SHIPMENT
 * pipeline; this mock immediately simulates the seller's shipment arriving
 * so the warehouse dashboard has something to inspect.
 */
export async function buyListing(
  assetId: string,
  fulfillmentChoice: "SHIP" | "VAULT",
  escrowLock?: { tradeId: string; txSignature: string; lamports: string; tradeAccount: string },
) {
  const user = await getCurrentUser();
  if (user.isBanned) throw new Error("Your account is suspended and can't make purchases.");
  const asset = await prisma.asset.findUniqueOrThrow({ where: { id: assetId }, include: { owner: true } });

  if (!asset.forSale || asset.priceThb == null) {
    throw new Error("This item is not currently for sale.");
  }
  if (asset.ownerId === user.id) {
    throw new Error("You already own this item.");
  }

  await completePurchase({
    asset,
    user,
    priceThb: asset.priceThb,
    fulfillmentChoice,
    escrowLock,
    soldNote: `${asset.name} sold instantly from your vault for ${asset.priceThb.toLocaleString()} THB.`,
    purchasedNote: asset.vaulted
      ? `${asset.name} is yours — ownership transferred instantly from the vault.`
      : `${asset.name} — your payment of ${asset.priceThb.toLocaleString()} THB is held safely until warehouse inspection passes.`,
  });
}

// ---------------------------------------------------------------------------
// Auctions — a separate sale channel from the fixed-price marketplace above.
// No cron/background job settles these: expiry is checked lazily wherever an
// auction is read (see getActiveAuctions/getAuctionById in lib/queries.ts),
// and a sold auction still needs its winner to actively claim it with a real
// wallet signature — see claimAuctionWin below.
// ---------------------------------------------------------------------------

const MIN_BID_INCREMENT_THB = 50;
const ANTI_SNIPING_WINDOW_MS = 5 * 60_000;
const ANTI_SNIPING_EXTENSION_MS = 5 * 60_000;

const startAuctionSchema = z.object({
  startPriceThb: z.coerce.number().int().min(100),
  durationDays: z.coerce.number().int().min(1).max(14),
  startTime: z.string().datetime().optional(),
});

/** Seller puts an item up for auction — supersedes any fixed-price listing (forSale is cleared). */
export async function startAuction(assetId: string, startPriceThb: number, durationDays: number, startTime?: string) {
  const user = await getCurrentUser();
  if (user.isBanned) throw new Error("Your account is suspended and can't start an auction.");
  const parsed = startAuctionSchema.safeParse({ startPriceThb, durationDays, startTime });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid auction details.");

  const asset = await prisma.asset.findUniqueOrThrow({ where: { id: assetId } });
  if (asset.ownerId !== user.id) throw new Error("You do not own this item.");
  if (asset.marketStatus === "IN_ESCROW") throw new Error("This item is locked in an active sale.");
  if (asset.marketStatus === "IN_AUCTION") throw new Error("This item is already up for auction.");
  if (asset.redeemedAt) throw new Error("This item was redeemed and can't be auctioned.");

  const auctionStartTime = parsed.data.startTime ? new Date(parsed.data.startTime) : new Date();
  if (auctionStartTime.getTime() < Date.now() - 60_000) throw new Error("Choose a future auction start time.");
  if (auctionStartTime.getTime() > Date.now() + 30 * 86_400_000) throw new Error("Auctions can be scheduled up to 30 days ahead.");
  const endTime = new Date(auctionStartTime.getTime() + parsed.data.durationDays * 86_400_000);

  await prisma.$transaction([
    prisma.auction.create({
      data: { assetId, startPriceThb: parsed.data.startPriceThb, startTime: auctionStartTime, endTime },
    }),
    prisma.asset.update({
      where: { id: assetId },
      data: { forSale: false, marketStatus: "IN_AUCTION", transferApproved: false },
    }),
  ]);
  await cancelTradesInvolving(assetId);

  if (auctionStartTime > new Date()) {
    const watchers = await prisma.watchlistItem.findMany({ where: { assetId }, select: { userId: true } });
    await Promise.all(
      watchers.map((watcher) =>
        notifyUser(
          watcher.userId,
          "AUCTION_STARTING",
          "Auction scheduled",
          `${asset.name} starts bidding on ${auctionStartTime.toLocaleString()}.`,
          `/item/${assetId}`,
        ),
      ),
    );
  }

  revalidateMarketplace(assetId);
  revalidatePath("/auctions");
}

/** Seller cancels an auction — only while it has zero bids, so no bidder is ever pulled out from under after committing to a price. */
export async function cancelAuction(auctionId: string) {
  const user = await getCurrentUser();
  const auction = await prisma.auction.findUniqueOrThrow({
    where: { id: auctionId },
    include: { asset: true, _count: { select: { bids: true } } },
  });
  if (auction.asset.ownerId !== user.id) throw new Error("You do not own this item.");
  if (auction.status !== "ACTIVE") throw new Error("This auction has already ended.");
  if (auction._count.bids > 0) throw new Error("Can't cancel an auction that already has bids.");

  await prisma.$transaction([
    prisma.auction.update({ where: { id: auctionId }, data: { status: "CANCELLED", settledAt: new Date() } }),
    prisma.asset.update({
      where: { id: auction.assetId },
      // Mirrors delistAsset/vaultRelist's own state split — a vaulted item
      // just goes back to sitting in the vault unlisted, a non-vaulted one
      // goes fully DELISTED like any other manual delist.
      data: { marketStatus: auction.asset.vaulted ? "IN_VAULT" : "DELISTED" },
    }),
  ]);

  revalidateMarketplace(auction.assetId);
  revalidatePath("/auctions");
}

const placeBidSchema = z.object({ amountThb: z.coerce.number().int().min(1) });

/** Buyer places a bid — must clear the current highest (or the start price, if none yet) by at least MIN_BID_INCREMENT_THB. */
export async function placeBid(auctionId: string, amountThb: number) {
  const user = await getCurrentUser();
  if (user.isBanned) throw new Error("Your account is suspended and can't bid.");
  const parsed = placeBidSchema.safeParse({ amountThb });
  if (!parsed.success) throw new Error("Enter a valid bid amount.");

  const auction = await prisma.auction.findUniqueOrThrow({ where: { id: auctionId }, include: { asset: true } });
  if (auction.asset.ownerId === user.id) throw new Error("You can't bid on your own item.");
  const now = new Date();
  if (auction.startTime > now) throw new Error("This auction has not started yet.");
  if (auction.status !== "ACTIVE" || auction.endTime <= new Date()) {
    throw new Error("This auction has ended.");
  }

  const minBid = (auction.currentBidThb ?? auction.startPriceThb - MIN_BID_INCREMENT_THB) + MIN_BID_INCREMENT_THB;
  if (parsed.data.amountThb < minBid) {
    throw new Error(`Bid at least ${minBid.toLocaleString()} THB.`);
  }

  // Previous highest bidder, if any — read before the write so there's
  // something to compare against for the outbid notification below. A real
  // race between two simultaneous top bids is vanishingly unlikely at this
  // scale and isn't worth a DB-level lock here.
  const previousTopBid = await prisma.bid.findFirst({ where: { auctionId }, orderBy: { amountThb: "desc" } });

  const shouldExtend = auction.endTime.getTime() - now.getTime() <= ANTI_SNIPING_WINDOW_MS;
  const extendedEndTime = shouldExtend ? new Date(auction.endTime.getTime() + ANTI_SNIPING_EXTENSION_MS) : auction.endTime;

  await prisma.$transaction([
    prisma.bid.create({ data: { auctionId, bidderId: user.id, amountThb: parsed.data.amountThb } }),
    prisma.auction.update({
      where: { id: auctionId },
      data: { currentBidThb: parsed.data.amountThb, ...(shouldExtend ? { endTime: extendedEndTime } : {}) },
    }),
  ]);

  if (previousTopBid && previousTopBid.bidderId !== user.id) {
    await notifyUser(
      previousTopBid.bidderId,
      "OUTBID",
      "You've been outbid",
      `Someone bid ${parsed.data.amountThb.toLocaleString()} THB on ${auction.asset.name}.`,
      `/auctions/${auctionId}`,
    );
  }

  revalidatePath(`/auctions/${auctionId}`);
  revalidatePath("/auctions");
  return { extended: shouldExtend, endTime: extendedEndTime.toISOString() };
}

/**
 * The winning bidder claims a finished auction — same real wallet-signed
 * escrow lock as any other purchase (see completePurchase above). Nothing
 * transfers automatically the instant endTime passes; the winner has to
 * actively come complete it, since only they can sign for their own payment.
 */
export async function claimAuctionWin(
  auctionId: string,
  fulfillmentChoice: "SHIP" | "VAULT",
  escrowLock?: { tradeId: string; txSignature: string; lamports: string; tradeAccount: string },
) {
  const user = await getCurrentUser();
  if (user.isBanned) throw new Error("Your account is suspended and can't complete a purchase.");

  const auction = await prisma.auction.findUniqueOrThrow({
    where: { id: auctionId },
    include: { asset: { include: { owner: true } } },
  });
  if (auction.status !== "ACTIVE" || auction.endTime > new Date()) {
    throw new Error("This auction hasn't ended yet.");
  }
  const topBid = await prisma.bid.findFirst({ where: { auctionId }, orderBy: { amountThb: "desc" } });
  if (!topBid) throw new Error("This auction ended with no bids.");
  if (topBid.bidderId !== user.id) throw new Error("Only the winning bidder can claim this auction.");

  await prisma.auction.update({ where: { id: auctionId }, data: { status: "ENDED_SOLD", settledAt: new Date() } });
  // completePurchase's vaulted branch only ever touches ownerId/forSale, not
  // marketStatus — reset it back from IN_AUCTION to IN_VAULT first so a
  // vaulted win doesn't get stuck reading "Up for Auction" forever.
  if (auction.asset.vaulted) {
    await prisma.asset.update({ where: { id: auction.assetId }, data: { marketStatus: "IN_VAULT" } });
  }

  await completePurchase({
    asset: auction.asset,
    user,
    priceThb: topBid.amountThb,
    fulfillmentChoice,
    escrowLock,
    soldNote: `${auction.asset.name} sold at auction for ${topBid.amountThb.toLocaleString()} THB.`,
    purchasedNote: `You won the auction for ${auction.asset.name} at ${topBid.amountThb.toLocaleString()} THB.`,
  });

  await notifyUser(
    user.id,
    "AUCTION_WON",
    "You won the auction",
    `You won ${auction.asset.name} for ${topBid.amountThb.toLocaleString()} THB.`,
    `/auctions/${auctionId}`,
  );

  revalidatePath(`/auctions/${auctionId}`);
}

// ---------------------------------------------------------------------------
// Offers — a buyer-proposed price on a fixed-price listing. Accepting one
// doesn't transfer anything by itself, it just clears the buyer to complete
// the purchase at that price (completeOfferPurchase), the same real
// wallet-signed escrow lock any other purchase needs.
// ---------------------------------------------------------------------------

const makeOfferSchema = z.object({
  amountThb: z.coerce.number().int().min(100),
  message: z.string().max(500).optional(),
});

export async function makeOffer(assetId: string, amountThb: number, message?: string) {
  const user = await getCurrentUser();
  if (user.isBanned) throw new Error("Your account is suspended and can't make offers.");
  const parsed = makeOfferSchema.safeParse({ amountThb, message });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Enter a valid offer.");

  const asset = await prisma.asset.findUniqueOrThrow({ where: { id: assetId } });
  if (!asset.forSale) throw new Error("This item is not currently for sale.");
  if (asset.ownerId === user.id) throw new Error("You already own this item.");

  const existing = await prisma.offer.findFirst({ where: { assetId, buyerId: user.id, status: "PENDING" } });
  if (existing) throw new Error("You already have a pending offer on this item.");

  await prisma.offer.create({
    data: {
      assetId,
      buyerId: user.id,
      sellerId: asset.ownerId,
      amountThb: parsed.data.amountThb,
      message: parsed.data.message || null,
    },
  });

  await notifyUser(
    asset.ownerId,
    "OFFER_RECEIVED",
    "New offer received",
    `${user.name ?? user.handle ?? "A buyer"} offered ${parsed.data.amountThb.toLocaleString()} THB for ${asset.name}.`,
    `/portfolio`,
  );

  revalidatePath("/portfolio");
  revalidatePath(`/item/${assetId}`);
}

/** Seller accepts or rejects a pending offer. */
export async function respondToOffer(offerId: string, action: "accept" | "reject") {
  const user = await getCurrentUser();
  const offer = await prisma.offer.findUniqueOrThrow({ where: { id: offerId }, include: { asset: true } });
  if (offer.sellerId !== user.id) throw new Error("You do not own this item.");
  if (offer.status !== "PENDING") throw new Error("This offer has already been resolved.");

  if (action === "accept") {
    if (!offer.asset.forSale) throw new Error("This item is no longer for sale.");
    await prisma.offer.update({ where: { id: offerId }, data: { status: "ACCEPTED", respondedAt: new Date() } });
    await notifyUser(
      offer.buyerId,
      "OFFER_ACCEPTED",
      "Offer accepted",
      `Your offer of ${offer.amountThb.toLocaleString()} THB for ${offer.asset.name} was accepted — complete your purchase.`,
      `/item/${offer.assetId}`,
    );
  } else {
    await prisma.offer.update({ where: { id: offerId }, data: { status: "REJECTED", respondedAt: new Date() } });
    await notifyUser(
      offer.buyerId,
      "OFFER_REJECTED",
      "Offer declined",
      `Your offer of ${offer.amountThb.toLocaleString()} THB for ${offer.asset.name} was declined.`,
      `/item/${offer.assetId}`,
    );
  }

  revalidatePath("/portfolio");
}

/** Buyer withdraws their own still-pending offer. */
export async function withdrawOffer(offerId: string) {
  const user = await getCurrentUser();
  const offer = await prisma.offer.findUniqueOrThrow({ where: { id: offerId } });
  if (offer.buyerId !== user.id) throw new Error("This is not your offer.");
  if (offer.status !== "PENDING") throw new Error("This offer has already been resolved.");

  await prisma.offer.update({ where: { id: offerId }, data: { status: "WITHDRAWN", respondedAt: new Date() } });
  revalidatePath("/portfolio");
}

/** Buyer completes a purchase at an already-accepted offer price — same real escrow-lock signing as buyListing, just at a negotiated price instead of the asking price. */
export async function completeOfferPurchase(
  offerId: string,
  fulfillmentChoice: "SHIP" | "VAULT",
  escrowLock?: { tradeId: string; txSignature: string; lamports: string; tradeAccount: string },
) {
  const user = await getCurrentUser();
  if (user.isBanned) throw new Error("Your account is suspended and can't make purchases.");

  const offer = await prisma.offer.findUniqueOrThrow({
    where: { id: offerId },
    include: { asset: { include: { owner: true } } },
  });
  if (offer.buyerId !== user.id) throw new Error("This is not your offer.");
  if (offer.status !== "ACCEPTED") throw new Error("This offer hasn't been accepted.");
  if (!offer.asset.forSale) throw new Error("This item is no longer for sale.");
  if (offer.asset.ownerId === user.id) throw new Error("You already own this item.");

  await completePurchase({
    asset: offer.asset,
    user,
    priceThb: offer.amountThb,
    fulfillmentChoice,
    escrowLock,
    soldNote: `${offer.asset.name} sold for ${offer.amountThb.toLocaleString()} THB (accepted offer).`,
    purchasedNote: offer.asset.vaulted
      ? `${offer.asset.name} is yours — ownership transferred instantly from the vault.`
      : `${offer.asset.name} — your payment of ${offer.amountThb.toLocaleString()} THB is held safely until warehouse inspection passes.`,
  });
}

async function loadInboundPackage(inboundPackageId: string) {
  return prisma.inboundPackage.findUniqueOrThrow({
    where: { id: inboundPackageId },
    include: { asset: true, escrowTx: { include: { buyer: true, seller: true } } },
  });
}

/**
 * Real release/refund when the trade was actually locked on-chain (both
 * wallet addresses present). Falls back to the old simulated signature only
 * when the escrow authority isn't configured at all, or either side lacks a
 * real wallet — i.e. cases where nothing real was ever at stake. If the
 * trade genuinely holds real locked funds and the on-chain call itself
 * fails (bad RPC, authority out of fees, etc.), this throws instead of
 * quietly "completing" the trade in the DB — the money is still sitting in
 * the on-chain Trade PDA, so pretending otherwise would leave our records
 * claiming a payout that never happened.
 */
async function releaseOrRefundEscrow(
  kind: "release" | "refund",
  escrowTx: { onChain: boolean; onChainTradeId: bigint | null; buyer: { walletAddress: string | null }; seller: { walletAddress: string | null } },
  assetId: string,
): Promise<{ signature: string; onChain: boolean }> {
  if (!escrowTx.onChain) {
    // Nothing real was ever locked — the old simulated flow is a safe,
    // honest fallback.
    const mock = await mockEscrowInstruction(kind, assetId);
    return { signature: mock.txSignature, onChain: false };
  }

  // From here, real funds are genuinely sitting in an on-chain Trade PDA —
  // any failure below must propagate, not get swallowed into a fake
  // "completed" DB state while the money stays stuck on-chain.
  const authorityAddress = await getEscrowAuthorityAddress();
  if (!authorityAddress) {
    throw new Error(
      "This trade holds real on-chain funds, but the escrow authority isn't configured (ESCROW_AUTHORITY_SECRET_KEY).",
    );
  }
  if (escrowTx.onChainTradeId == null || !escrowTx.buyer.walletAddress || !escrowTx.seller.walletAddress) {
    throw new Error("This trade is marked on-chain but is missing the data needed to release/refund it.");
  }

  const signature =
    kind === "release"
      ? await releaseTradeToSeller({
          buyer: escrowTx.buyer.walletAddress,
          seller: escrowTx.seller.walletAddress,
          tradeId: escrowTx.onChainTradeId,
        })
      : await refundTradeToBuyer({
          buyer: escrowTx.buyer.walletAddress,
          tradeId: escrowTx.onChainTradeId,
        });
  return { signature, onChain: true };
}

/**
 * Real on-chain SPL transfer when the asset has a real mint and the current
 * owner has a live delegate approval on file (see confirmListingApproval /
 * updateListingPrice / vaultRelist) — the escrow authority spends that
 * approval to move the token, mirroring releaseOrRefundEscrow's real/mock
 * branch. Falls back to the old simulated transfer for legacy assets, or
 * whenever the approval was never granted or already consumed. A genuine
 * on-chain failure here throws rather than silently downgrading to mock,
 * same reasoning as releaseOrRefundEscrow.
 */
async function transferOwnership(
  asset: { id: string; mintAddress: string | null; transferApproved: boolean },
  fromWalletAddress: string | null,
  toWalletAddress: string | null,
  toUserId: string,
): Promise<{ signature: string; onChain: boolean }> {
  if (asset.mintAddress && asset.transferApproved && fromWalletAddress && toWalletAddress) {
    const signature = await transferDigitalTwinToken({
      mintAddress: asset.mintAddress,
      fromAddress: fromWalletAddress,
      toAddress: toWalletAddress,
    });
    await prisma.asset.update({ where: { id: asset.id }, data: { transferApproved: false } });
    return { signature, onChain: true };
  }
  const mock = await mockTransferOwnership(asset.id, toUserId);
  return { signature: mock.txSignature, onChain: false };
}

/** Warehouse verifies the slab, then ships it directly to the buyer's address. */
export async function warehouseApproveShip(inboundPackageId: string) {
  await requireAdmin();
  const pkg = await loadInboundPackage(inboundPackageId);
  const transfer = await transferOwnership(
    pkg.asset,
    pkg.escrowTx.seller.walletAddress,
    pkg.escrowTx.buyer.walletAddress,
    pkg.escrowTx.buyerId,
  );
  const release = await releaseOrRefundEscrow("release", pkg.escrowTx, pkg.assetId);

  await prisma.$transaction([
    prisma.inboundPackage.update({
      where: { id: inboundPackageId },
      data: { status: "APPROVED_SHIP", resolvedAt: new Date() },
    }),
    prisma.escrowTransaction.update({
      where: { id: pkg.escrowTxId },
      data: { status: "RELEASED", releasedAt: new Date() },
    }),
    prisma.asset.update({
      where: { id: pkg.assetId },
      data: {
        ownerId: pkg.escrowTx.buyerId,
        forSale: false,
        vaulted: false,
        marketStatus: "DELISTED",
        pipelineStage: "DELIVERED",
      },
    }),
    prisma.provenanceEvent.createMany({
      data: [
        {
          assetId: pkg.assetId,
          type: "INSPECTION_PASSED",
          note: `Serial and slab authenticity verified against ${pkg.officialGradingCompany} database.`,
          mockTxSignature: transfer.signature,
        },
        {
          assetId: pkg.assetId,
          type: "DELIVERED_TO_BUYER",
          note: "Shipping label generated and package delivered to buyer's address.",
          mockTxSignature: transfer.signature,
        },
        {
          assetId: pkg.assetId,
          type: "OWNERSHIP_TRANSFERRED",
          note: "Digital ownership transferred to buyer; escrow released to seller.",
          mockTxSignature: transfer.signature,
          onChain: transfer.onChain,
        },
      ],
    }),
  ]);
  void release;

  await notifyUser(
    pkg.escrowTx.sellerId,
    "ITEM_SOLD",
    "Item sold",
    `${pkg.asset.name} passed inspection and sold for ${pkg.escrowTx.amountThb.toLocaleString()} THB.`,
    `/item/${pkg.assetId}`,
  );
  revalidateMarketplace(pkg.assetId);
}

/** Warehouse verifies the slab, then deposits it into the platform vault for the buyer. */
export async function warehouseApproveVault(inboundPackageId: string, vaultLocation?: string) {
  await requireAdmin();
  const pkg = await loadInboundPackage(inboundPackageId);
  const transfer = await transferOwnership(
    pkg.asset,
    pkg.escrowTx.seller.walletAddress,
    pkg.escrowTx.buyer.walletAddress,
    pkg.escrowTx.buyerId,
  );
  const release = await releaseOrRefundEscrow("release", pkg.escrowTx, pkg.assetId);

  await prisma.$transaction([
    prisma.inboundPackage.update({
      where: { id: inboundPackageId },
      data: { status: "APPROVED_VAULT", resolvedAt: new Date() },
    }),
    prisma.escrowTransaction.update({
      where: { id: pkg.escrowTxId },
      data: { status: "RELEASED", releasedAt: new Date() },
    }),
    prisma.asset.update({
      where: { id: pkg.assetId },
      data: {
        ownerId: pkg.escrowTx.buyerId,
        forSale: false,
        vaulted: true,
        marketStatus: "IN_VAULT",
        pipelineStage: "NONE",
        vaultLocation: vaultLocation?.trim() || undefined,
      },
    }),
    prisma.provenanceEvent.createMany({
      data: [
        {
          assetId: pkg.assetId,
          type: "INSPECTION_PASSED",
          note: `Serial and slab authenticity verified against ${pkg.officialGradingCompany} database.`,
          mockTxSignature: transfer.signature,
        },
        {
          assetId: pkg.assetId,
          type: "DEPOSITED_TO_VAULT",
          note: "Physical item deposited into the platform vault.",
          mockTxSignature: transfer.signature,
        },
        {
          assetId: pkg.assetId,
          type: "OWNERSHIP_TRANSFERRED",
          note: "Digital ownership transferred to buyer; escrow released to seller.",
          mockTxSignature: transfer.signature,
          onChain: transfer.onChain,
        },
      ],
    }),
  ]);
  void release;

  await notifyUser(
    pkg.escrowTx.sellerId,
    "ITEM_SOLD",
    "Item sold",
    `${pkg.asset.name} passed inspection and sold for ${pkg.escrowTx.amountThb.toLocaleString()} THB.`,
    `/item/${pkg.assetId}`,
  );
  revalidateMarketplace(pkg.assetId);
}

/** Warehouse flags a mismatch: refund the buyer and return the item to the seller. */
export async function warehouseReject(inboundPackageId: string) {
  await requireAdmin();
  const pkg = await loadInboundPackage(inboundPackageId);
  const refund = await releaseOrRefundEscrow("refund", pkg.escrowTx, pkg.assetId);

  await prisma.$transaction([
    prisma.inboundPackage.update({
      where: { id: inboundPackageId },
      data: { status: "REJECTED", resolvedAt: new Date() },
    }),
    prisma.escrowTransaction.update({
      where: { id: pkg.escrowTxId },
      data: { status: "REFUNDED" },
    }),
    prisma.asset.update({
      where: { id: pkg.assetId },
      data: {
        forSale: true,
        marketStatus: "READY_TO_SHIP",
        pipelineStage: "NONE",
      },
    }),
    prisma.provenanceEvent.createMany({
      data: [
        {
          assetId: pkg.assetId,
          type: "INSPECTION_REJECTED",
          note: "Declared certificate data did not match the official grading database. Item returned to seller.",
          mockTxSignature: refund.signature,
        },
        {
          assetId: pkg.assetId,
          type: "ESCROW_REFUNDED",
          note: "Buyer payment refunded in full.",
          mockTxSignature: refund.signature,
          onChain: refund.onChain,
        },
      ],
    }),
  ]);

  revalidateMarketplace(pkg.assetId);
}

export interface BulkActionResult {
  succeeded: string[];
  skipped: { id: string; itemName: string; reason: string }[];
}

/**
 * Bulk-approves every selected inbound package that has NO mismatch
 * between declared and official grading data — routes each to
 * warehouseApproveShip or warehouseApproveVault based on that trade's own
 * fulfillment choice (a buyer decision, not something staff picks in
 * bulk). Anything with a mismatch is skipped, never silently approved —
 * bulk action can never bypass the per-item verification check that
 * warehouseReject exists to catch; those still need the individual
 * Inspect dialog. One item failing (e.g. an on-chain release error)
 * doesn't abort the rest of the batch.
 */
export async function bulkApproveInboundPackages(inboundPackageIds: string[]): Promise<BulkActionResult> {
  await requireAdmin();
  const succeeded: string[] = [];
  const skipped: BulkActionResult["skipped"] = [];

  for (const id of inboundPackageIds) {
    let itemName = id;
    try {
      const pkg = await loadInboundPackage(id);
      itemName = pkg.asset.name;
      const allMatch =
        pkg.declaredSerial === pkg.officialSerial &&
        pkg.declaredGradingCompany === pkg.officialGradingCompany &&
        pkg.declaredGrade === pkg.officialGrade;
      if (!allMatch) {
        skipped.push({ id, itemName, reason: "Certificate data mismatch — needs individual review." });
        continue;
      }
      if (pkg.escrowTx.fulfillmentChoice === "VAULT") {
        await warehouseApproveVault(id);
      } else {
        await warehouseApproveShip(id);
      }
      succeeded.push(id);
    } catch (err) {
      skipped.push({ id, itemName, reason: err instanceof Error ? err.message : "Action failed." });
    }
  }

  return { succeeded, skipped };
}

/** Bulk-rejects the selected inbound packages — safe for any selection, mismatched or not. */
export async function bulkRejectInboundPackages(inboundPackageIds: string[]): Promise<BulkActionResult> {
  await requireAdmin();
  const succeeded: string[] = [];
  const skipped: BulkActionResult["skipped"] = [];

  for (const id of inboundPackageIds) {
    let itemName = id;
    try {
      const pkg = await loadInboundPackage(id);
      itemName = pkg.asset.name;
      await warehouseReject(id);
      succeeded.push(id);
    } catch (err) {
      skipped.push({ id, itemName, reason: err instanceof Error ? err.message : "Action failed." });
    }
  }

  return { succeeded, skipped };
}

/**
 * Real on-chain signature takes priority when the client actually signed
 * one (see components/portfolio/portfolio-item-card.tsx — a real Approve
 * when the asset has a mint, a Memo otherwise); falls back to the simulated
 * escrow instruction only when no real wallet was available to sign with.
 */
async function resolveTxSignature(assetId: string, txSignature?: string) {
  if (txSignature) return { signature: txSignature, onChain: true };
  const mock = await mockEscrowInstruction("lock", assetId);
  return { signature: mock.txSignature, onChain: false };
}

/** Relists a vaulted item for instant, zero-shipping sale. */
export async function vaultRelist(assetId: string, priceThb: number, txSignature?: string) {
  const user = await getCurrentUser();
  const asset = await prisma.asset.findUniqueOrThrow({ where: { id: assetId } });
  if (asset.ownerId !== user.id) throw new Error("You do not own this item.");
  if (!asset.vaulted) throw new Error("Only vaulted items can be relisted instantly.");
  if (asset.marketStatus === "IN_AUCTION") throw new Error("This item is up for auction.");
  if (!Number.isInteger(priceThb) || priceThb < 100) throw new Error("Enter a valid price.");

  const wasForSale = asset.forSale;
  const tx = await resolveTxSignature(assetId, txSignature);

  await prisma.asset.update({
    where: { id: assetId },
    data: {
      forSale: true,
      marketStatus: "IN_VAULT",
      priceThb,
      // A real Approve grants a fresh, one-time delegate approval — needs
      // redoing on every relist (a prior transfer would have consumed it).
      transferApproved: Boolean(asset.mintAddress) && Boolean(txSignature),
      priceSnapshots: { create: { priceThb } },
    },
  });
  await prisma.provenanceEvent.create({
    data: {
      assetId,
      type: "RELISTED",
      note: `Relisted for instant sale at ${priceThb.toLocaleString()} THB.`,
      mockTxSignature: tx.signature,
      onChain: tx.onChain,
      actorId: user.id,
    },
  });
  if (asset.priceThb != null) {
    await notifyWatchersOfPriceDrop(assetId, asset.name, asset.priceThb, priceThb);
  }
  if (!wasForSale) await notifyWantedCardMatches(assetId);

  revalidateMarketplace(assetId);
}

/**
 * Lists (or reprices) a non-vaulted item the seller physically still holds.
 * Vaulted items go through vaultRelist instead — this is specifically for
 * the "in your hands" gap: previously there was no way to change price or
 * relist a delisted, un-vaulted item at all.
 */
export async function updateListingPrice(assetId: string, priceThb: number, txSignature?: string) {
  const user = await getCurrentUser();
  const asset = await prisma.asset.findUniqueOrThrow({ where: { id: assetId } });
  if (asset.ownerId !== user.id) throw new Error("You do not own this item.");
  if (asset.vaulted) throw new Error("Vaulted items are repriced via Relist instead.");
  if (asset.redeemedAt) throw new Error("This item was redeemed — its digital twin was burned, so it can't be listed again.");
  if (asset.marketStatus === "IN_ESCROW") throw new Error("This item is locked in an active sale.");
  if (asset.marketStatus === "IN_AUCTION") throw new Error("This item is up for auction.");
  if (!Number.isInteger(priceThb) || priceThb < 100) throw new Error("Enter a valid price.");

  const wasForSale = asset.forSale;
  const tx = await resolveTxSignature(assetId, txSignature);

  await prisma.asset.update({
    where: { id: assetId },
    data: {
      priceThb,
      forSale: true,
      marketStatus: "READY_TO_SHIP",
      // See vaultRelist — a real Approve needs redoing on every (re)listing.
      transferApproved: Boolean(asset.mintAddress) && Boolean(txSignature),
      priceSnapshots: { create: { priceThb } },
    },
  });
  await prisma.provenanceEvent.create({
    data: {
      assetId,
      type: "LISTED",
      note: wasForSale
        ? `Price updated to ${priceThb.toLocaleString()} THB.`
        : `Relisted for sale at ${priceThb.toLocaleString()} THB.`,
      mockTxSignature: tx.signature,
      onChain: tx.onChain,
      actorId: user.id,
    },
  });
  if (asset.priceThb != null) {
    await notifyWatchersOfPriceDrop(assetId, asset.name, asset.priceThb, priceThb);
  }
  if (!wasForSale) await notifyWantedCardMatches(assetId);

  revalidateMarketplace(assetId);
}

/** Takes a non-vaulted, currently-listed item off the marketplace without dispatching it anywhere. */
export async function delistAsset(assetId: string, txSignature?: string) {
  const user = await getCurrentUser();
  const asset = await prisma.asset.findUniqueOrThrow({ where: { id: assetId } });
  if (asset.ownerId !== user.id) throw new Error("You do not own this item.");
  if (asset.vaulted) throw new Error("Vaulted items can't be delisted this way.");
  if (asset.marketStatus === "IN_ESCROW") throw new Error("This item is locked in an active sale.");
  if (!asset.forSale) throw new Error("This item is not currently listed.");

  const tx = await resolveTxSignature(assetId, txSignature);

  await prisma.asset.update({
    where: { id: assetId },
    // Always clears the delegate approval on delist (a real Revoke when the
    // client signed one, but cleared in our own records either way — a
    // delisted item should never look transferable to the next sale).
    data: { forSale: false, marketStatus: "DELISTED", transferApproved: false },
  });
  await prisma.provenanceEvent.create({
    data: {
      assetId,
      type: "DELISTED",
      note: "Delisted from the marketplace.",
      mockTxSignature: tx.signature,
      onChain: tx.onChain,
      actorId: user.id,
    },
  });

  revalidateMarketplace(assetId);
}

const submitForGradingSchema = z.object({
  itemName: z.string().min(2),
  itemSubtitle: z.string().min(2),
  category: z.enum(["TRADING_CARD", "SPORTS_CARD", "COMIC"]),
  gradingCompany: z.enum(["PSA", "BGS", "CGC"]),
});

export interface SubmitForGradingState {
  error?: string;
  submissionId?: string;
}

/**
 * Full-Service package: seller pays one bundled mock fee (shipping the raw
 * item to the grading company + the grading company's fee + minting) and
 * the platform handles the rest. Produces a pending GradingSubmission, not
 * yet an Asset — that only exists once `adminCompleteGrading` resolves it.
 */
export async function submitForGrading(
  _prev: SubmitForGradingState,
  formData: FormData,
): Promise<SubmitForGradingState> {
  const user = await getCurrentUser();
  if (user.isBanned) return { error: "Your account is suspended and can't submit items for grading." };
  const parsed = submitForGradingSchema.safeParse({
    itemName: formData.get("itemName"),
    itemSubtitle: formData.get("itemSubtitle"),
    category: formData.get("category"),
    gradingCompany: formData.get("gradingCompany"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid submission details." };
  }
  const data = parsed.data;

  const payment = await mockEscrowInstruction("lock", "grading-submission");
  const submission = await prisma.gradingSubmission.create({
    data: {
      itemName: data.itemName,
      itemSubtitle: data.itemSubtitle,
      category: data.category as AssetCategory,
      gradingCompany: data.gradingCompany as GradingCompany,
      packagePriceThb: FULL_SERVICE_PACKAGE_PRICE_THB,
      status: "AWAITING_SHIPMENT_TO_GRADER",
      mockPaymentTx: payment.txSignature,
      sellerId: user.id,
    },
  });

  revalidatePath("/portfolio");
  revalidatePath("/admin/warehouse");
  return { submissionId: submission.id };
}

async function loadGradingSubmission(submissionId: string) {
  return prisma.gradingSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: { seller: true },
  });
}

/** Staff confirms the raw item has been shipped out to the grading company. */
export async function adminMarkAtGradingCompany(submissionId: string) {
  await requireAdmin();
  const submission = await loadGradingSubmission(submissionId);
  if (submission.status !== "AWAITING_SHIPMENT_TO_GRADER") {
    throw new Error("This submission is not awaiting shipment.");
  }
  await prisma.gradingSubmission.update({
    where: { id: submissionId },
    data: { status: "AT_GRADING_COMPANY" },
  });
  revalidatePath("/admin/warehouse");
  revalidatePath("/portfolio");
}

/** Bulk version — for when staff physically ship a batch of raw items to the grading company in one box. */
export async function bulkMarkAtGradingCompany(submissionIds: string[]): Promise<BulkActionResult> {
  await requireAdmin();
  const succeeded: string[] = [];
  const skipped: BulkActionResult["skipped"] = [];

  for (const id of submissionIds) {
    let itemName = id;
    try {
      const submission = await loadGradingSubmission(id);
      itemName = submission.itemName;
      await adminMarkAtGradingCompany(id);
      succeeded.push(id);
    } catch (err) {
      skipped.push({ id, itemName, reason: err instanceof Error ? err.message : "Action failed." });
    }
  }

  return { succeeded, skipped };
}

const completeGradingSchema = z.object({
  grade: z.coerce.number().min(1).max(10),
  isBlackLabel: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export interface CompleteGradingState {
  error?: string;
  assetId?: string;
}

/**
 * Staff records the grading company's result: mints the digital twin and
 * turns the submission into a real, listable Asset owned by the seller.
 */
export async function adminCompleteGrading(
  submissionId: string,
  _prev: CompleteGradingState,
  formData: FormData,
): Promise<CompleteGradingState> {
  await requireAdmin();
  const submission = await loadGradingSubmission(submissionId);
  if (submission.status !== "AT_GRADING_COMPANY") {
    return { error: "This submission has not been sent to the grading company yet." };
  }
  const parsed = completeGradingSchema.safeParse({
    grade: formData.get("grade"),
    isBlackLabel: formData.get("isBlackLabel") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid grade." };
  }
  const isBlackLabel =
    submission.gradingCompany === "BGS" && parsed.data.grade === BGS_BLACK_LABEL_GRADE && Boolean(parsed.data.isBlackLabel);
  const gradeTier = gradeTierLabel(submission.gradingCompany, parsed.data.grade, isBlackLabel);

  const serial = `${submission.gradingCompany}-${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
  const themeIndex = serial.length % 8;

  // Real, server-signed mint (see createListing above for the same
  // pattern) — the admin was never the right signer for someone else's
  // token anyway, so this needs no client-signature plumbing at all.
  const authorityAddress = await getEscrowAuthorityAddress();
  let mintTxSignature: string;
  let isOnChain: boolean;
  let mintAddress: string | null = null;
  if (authorityAddress && submission.seller.walletAddress) {
    const minted = await mintDigitalTwinToken({ ownerAddress: submission.seller.walletAddress });
    mintTxSignature = minted.txSignature;
    mintAddress = minted.mintAddress;
    isOnChain = true;
  } else {
    mintTxSignature = (await mockMintDigitalTwin(serial)).txSignature;
    isOnChain = false;
  }

  const asset = await prisma.asset.create({
    data: {
      name: submission.itemName,
      subtitle: submission.itemSubtitle,
      category: submission.category,
      gradingCompany: submission.gradingCompany,
      grade: parsed.data.grade,
      isBlackLabel,
      serial,
      themeIndex,
      forSale: false,
      vaulted: false,
      marketStatus: "DELISTED",
      pipelineStage: "NONE",
      mockMintTx: mintTxSignature,
      mintAddress,
      verificationPackage: "FULL_SERVICE",
      mintFeeThb: submission.packagePriceThb,
      sellerId: submission.sellerId,
      ownerId: submission.sellerId,
    },
  });

  await prisma.gradingSubmission.update({
    where: { id: submissionId },
    data: { status: "GRADED", resolvedAt: new Date(), resultAssetId: asset.id },
  });

  await prisma.provenanceEvent.create({
    data: {
      assetId: asset.id,
      type: "MINTED_DIGITAL_TWIN",
      note: `Full-Service package (${submission.packagePriceThb.toLocaleString()} THB): graded ${submission.gradingCompany} ${parsed.data.grade}${gradeTier ? ` (${gradeTier})` : ""} by the grading company, digital twin minted by the platform.`,
      mockTxSignature: mintTxSignature,
      onChain: isOnChain,
      actorId: submission.sellerId,
    },
  });

  await notifyUser(
    submission.sellerId,
    "GRADING_COMPLETE",
    "Grading complete",
    `${submission.itemName} came back graded ${submission.gradingCompany} ${parsed.data.grade} — set a price to list it.`,
    `/item/${asset.id}`,
  );

  revalidateMarketplace(asset.id);
  return { assetId: asset.id };
}

/** Staff rejects a raw item — e.g. the grading company found it inauthentic. */
export async function adminRejectGradingSubmission(submissionId: string) {
  await requireAdmin();
  const submission = await loadGradingSubmission(submissionId);
  if (submission.status === "GRADED" || submission.status === "REJECTED") {
    throw new Error("This submission has already been resolved.");
  }
  await prisma.gradingSubmission.update({
    where: { id: submissionId },
    data: { status: "REJECTED", resolvedAt: new Date() },
  });
  revalidatePath("/admin/warehouse");
  revalidatePath("/portfolio");
}

/**
 * Redeems a vaulted item: the warehouse dispatches the physical card to the
 * owner's address, and its digital twin is burned so no token is left
 * trading without the card behind it.
 *
 * When the asset has a real SPL mint that is actually in the owner's wallet,
 * the owner must sign a real BurnChecked (burnTxSignature, built client-side
 * by lib/web3/token-program.ts::buildBurnTransaction) — redeem is refused
 * without it. Legacy/simulated assets, or ones whose token never reached this
 * owner because an earlier transfer was simulated, get a simulated burn
 * recorded instead. Either way the asset is marked redeemed and can never be
 * listed, auctioned or swapped again.
 */
export async function vaultRedeem(assetId: string, burnTxSignature?: string) {
  const user = await getCurrentUser();
  const asset = await prisma.asset.findUniqueOrThrow({ where: { id: assetId } });
  if (asset.ownerId !== user.id) throw new Error("You do not own this item.");
  if (!asset.vaulted) throw new Error("This item is not in the vault.");
  if (asset.redeemedAt) throw new Error("This item was already redeemed.");
  if (asset.marketStatus === "IN_AUCTION") throw new Error("End the auction before redeeming this item.");
  if (asset.marketStatus === "IN_ESCROW") throw new Error("This item is locked in an active sale.");
  if (!user.shippingAddress) throw new Error("Add a shipping address in Portfolio before redeeming.");

  let burn: { signature: string; onChain: boolean };
  if (burnTxSignature) {
    burn = { signature: burnTxSignature, onChain: true };
  } else {
    if (asset.mintAddress && user.walletAddress) {
      const held = await isDigitalTwinHeldBy({ mintAddress: asset.mintAddress, ownerAddress: user.walletAddress });
      if (held) throw new Error("Sign the burn transaction in your wallet to redeem this item.");
    }
    burn = { signature: (await mockEscrowInstruction("release", assetId)).txSignature, onChain: false };
  }

  const dispatch = await mockEscrowInstruction("release", assetId);
  await prisma.asset.update({
    where: { id: assetId },
    data: {
      vaulted: false,
      forSale: false,
      marketStatus: "DELISTED",
      pipelineStage: "DELIVERED",
      transferApproved: false,
      vaultLocation: null,
      redeemedAt: new Date(),
      burnTxSignature: burn.signature,
    },
  });
  await prisma.provenanceEvent.createMany({
    data: [
      {
        assetId,
        type: "TOKEN_BURNED",
        note: burn.onChain
          ? "Owner burned the digital twin token on-chain — the certificate is retired with the physical card leaving the vault."
          : "Digital twin retired (simulated burn) — the certificate is retired with the physical card leaving the vault.",
        mockTxSignature: burn.signature,
        onChain: burn.onChain,
        actorId: user.id,
      },
      {
        assetId,
        type: "REDEEMED",
        note: "Physical item dispatched from the warehouse vault to the owner's home address.",
        mockTxSignature: dispatch.txSignature,
        actorId: user.id,
      },
    ],
  });

  await cancelTradesInvolving(assetId);
  revalidateMarketplace(assetId);
}

export interface AirdropState {
  error?: string;
  signature?: string;
}

/**
 * "Deposit" for a devnet wallet — requests real devnet SOL from Solana's
 * faucet straight into the current user's own wallet. Always targets the
 * caller's own walletAddress (never an arbitrary one passed from the
 * client), so this can't be used to spam-airdrop into someone else's wallet.
 */
export async function requestSolAirdrop(amountSol: number): Promise<AirdropState> {
  const user = await getCurrentUser();
  if (!user.walletAddress) {
    return { error: "No real Solana wallet on this account yet." };
  }
  if (!Number.isFinite(amountSol) || amountSol <= 0) {
    return { error: "Enter a valid amount." };
  }

  try {
    const signature = await requestDevnetAirdrop(user.walletAddress, amountSol);
    revalidatePath("/portfolio");
    return { signature };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Airdrop failed — the devnet faucet may be rate-limited. Try again shortly.",
    };
  }
}

export interface ReviewState {
  error?: string;
  success?: boolean;
}

/**
 * A buyer rates the seller after a completed purchase. Gated on the escrow
 * transaction being RELEASED (the sale actually went through) and on the
 * current user being that transaction's buyer — a seller can't review
 * themselves, and nobody can review a purchase that didn't happen. One
 * review per transaction, enforced by the schema's unique escrowTxId.
 */
export async function submitReview(escrowTxId: string, rating: number, comment: string): Promise<ReviewState> {
  const user = await getCurrentUser();

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: "Rating must be between 1 and 5 stars." };
  }

  const escrowTx = await prisma.escrowTransaction.findUnique({ where: { id: escrowTxId } });
  if (!escrowTx) return { error: "Purchase not found." };
  if (escrowTx.buyerId !== user.id) return { error: "You can only review your own purchases." };
  if (escrowTx.status !== "RELEASED") {
    return { error: "You can review the seller once this purchase is complete." };
  }

  const existing = await prisma.review.findUnique({ where: { escrowTxId } });
  if (existing) return { error: "You've already reviewed this purchase." };

  await prisma.review.create({
    data: {
      rating,
      comment: comment.trim() ? comment.trim() : null,
      sellerId: escrowTx.sellerId,
      buyerId: user.id,
      escrowTxId,
    },
  });

  revalidatePath(`/store/${escrowTx.sellerId}`);
  revalidatePath(`/item/${escrowTx.assetId}`);
  revalidatePath("/portfolio");
  return { success: true };
}

/** Thin server-action wrapper so the client-side range switcher (1d/7d/30d) on the price chart can re-fetch without a full page reload. */
export async function getAssetPriceHistory(assetId: string, range: PriceHistoryRange) {
  await getCurrentUser();
  const snapshots = await getPriceHistory(assetId, range);
  return snapshots.map((s) => ({ priceThb: s.priceThb, createdAt: s.createdAt.toISOString() }));
}

/**
 * Same range-switcher pattern, but for the current user's own total
 * portfolio value across every asset they own — always the caller's own
 * portfolio, never an arbitrary userId passed from the client.
 */
export async function getMyPortfolioPriceHistory(range: PriceHistoryRange) {
  const user = await getCurrentUser();
  const points = await getPortfolioPriceHistory(user.id, range);
  return points.map((p) => ({ totalThb: p.totalThb, createdAt: p.createdAt.toISOString() }));
}

/** Adds or removes an item from the current user's watchlist; returns the new state. */
export async function toggleWatchlist(assetId: string): Promise<{ watching: boolean }> {
  const user = await getCurrentUser();
  const existing = await prisma.watchlistItem.findUnique({
    where: { userId_assetId: { userId: user.id, assetId } },
  });

  if (existing) {
    await prisma.watchlistItem.delete({ where: { id: existing.id } });
    revalidatePath("/portfolio");
    revalidatePath(`/item/${assetId}`);
    return { watching: false };
  }

  await prisma.watchlistItem.create({ data: { userId: user.id, assetId } });
  revalidatePath("/portfolio");
  revalidatePath(`/item/${assetId}`);
  return { watching: true };
}

// ---------------------------------------------------------------------------
// Notifications — consumer-facing actions only ever touch the current
// user's own USER-audience rows (never take a userId param from the
// client). Admin actions are separately gated by requireAdmin() below.
// ---------------------------------------------------------------------------

/** Marks one of the current user's own notifications as read. No-ops silently if it's not theirs or already read. */
export async function markNotificationRead(notificationId: string) {
  const user = await getCurrentUser();
  await prisma.notification.updateMany({
    where: { id: notificationId, userId: user.id, audience: "USER" },
    data: { readAt: new Date() },
  });
  revalidatePath("/marketplace");
}

/** Marks every one of the current user's unread notifications as read (the "clear all" action in the bell). */
export async function markAllNotificationsRead() {
  const user = await getCurrentUser();
  await prisma.notification.updateMany({
    where: { userId: user.id, audience: "USER", readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/marketplace");
}

/** Staff-only: marks one broadcast alert read. Since ADMIN alerts aren't addressed to one person, this is "read by staff" in general, not per-admin. */
export async function markAdminAlertRead(notificationId: string) {
  await requireAdmin();
  await prisma.notification.updateMany({
    where: { id: notificationId, audience: "ADMIN" },
    data: { readAt: new Date() },
  });
  revalidatePath("/admin/warehouse");
}

/**
 * Staff-only: sets or updates where a vaulted item physically sits in the
 * warehouse (Row/Shelf/Box, however the warehouse labels it) — set once
 * when it's first deposited (see warehouseApproveVault), editable here
 * afterward for when it's physically moved.
 */
export async function updateVaultLocation(assetId: string, vaultLocation: string) {
  await requireAdmin();
  const asset = await prisma.asset.findUniqueOrThrow({ where: { id: assetId } });
  if (!asset.vaulted) throw new Error("This item isn't in the vault.");

  await prisma.asset.update({
    where: { id: assetId },
    data: { vaultLocation: vaultLocation.trim() || null },
  });
  revalidatePath("/admin/warehouse");
}

/**
 * Staff-only: suspends or restores a user's ability to list, submit for
 * grading, or buy. Never touches their existing listings, escrows, or
 * reviews — reversible, no destructive side effect, matching how the rest
 * of this app treats an admin action as a real state flip, not a wipe.
 */
export async function toggleUserBan(userId: string): Promise<{ isBanned: boolean }> {
  const admin = await requireAdmin();
  if (userId === admin.id) throw new Error("You can't suspend your own account.");

  const target = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isBanned: !target.isBanned },
  });
  revalidatePath("/admin/warehouse");
  return { isBanned: updated.isBanned };
}

// ---------------------------------------------------------------------------
// Direct messages — private buyer/seller threads (see Conversation in
// prisma/schema.prisma). One thread per pair of users, reused on every
// "Message Seller" click rather than starting a new one each time.
// ---------------------------------------------------------------------------

/** Finds or creates the thread between the current user and another user, returning its id. */
export async function startConversation(otherUserId: string) {
  const user = await getCurrentUser();
  if (otherUserId === user.id) throw new Error("You can't message yourself.");
  const other = await prisma.user.findUnique({ where: { id: otherUserId }, select: { id: true } });
  if (!other) throw new Error("That user no longer exists.");

  const [userAId, userBId] = [user.id, otherUserId].sort();
  const conversation = await prisma.conversation.upsert({
    where: { userAId_userBId: { userAId, userBId } },
    create: { userAId, userBId },
    update: {},
  });
  return conversation.id;
}

const sendMessageSchema = z.object({
  body: z.string().trim().min(1, "Message can't be empty.").max(2000, "Message is too long (2000 characters max)."),
});

export async function sendMessage(conversationId: string, body: string) {
  const user = await getCurrentUser();
  if (user.isBanned) throw new Error("Your account is suspended and can't send messages.");
  const parsed = sendMessageSchema.safeParse({ body });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Enter a message.");

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, OR: [{ userAId: user.id }, { userBId: user.id }] },
  });
  if (!conversation) throw new Error("Conversation not found.");

  const now = new Date();
  await prisma.$transaction([
    prisma.message.create({ data: { conversationId, senderId: user.id, body: parsed.data.body, createdAt: now } }),
    prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: now } }),
  ]);

  revalidatePath("/messages");
  revalidatePath(`/messages/${conversationId}`);
}

/** Marks every message the other person sent in this thread as read. */
export async function markConversationRead(conversationId: string) {
  const user = await getCurrentUser();
  await prisma.message.updateMany({
    where: {
      conversationId,
      senderId: { not: user.id },
      readAt: null,
      conversation: { OR: [{ userAId: user.id }, { userBId: user.id }] },
    },
    data: { readAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Wanted cards ("notify me when this card is listed") — matched in
// notifyWantedCardMatches above.
// ---------------------------------------------------------------------------

const wantedCardSchema = z.object({
  query: z.string().trim().min(2, "Enter at least 2 characters of the card name.").max(100),
  gradingCompany: z.enum(["PSA", "BGS", "CGC", "RAW"]).nullable(),
  minGrade: z.number().min(1).max(10).nullable(),
  blackLabelOnly: z.boolean(),
  maxPriceThb: z.number().int().min(100).nullable(),
  trustedOnly: z.boolean(),
});

const MAX_WANTED_CARDS = 20;

export async function addWantedCard(input: z.input<typeof wantedCardSchema>) {
  const user = await getCurrentUser();
  const parsed = wantedCardSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid alert.");
  const count = await prisma.wantedCard.count({ where: { userId: user.id } });
  if (count >= MAX_WANTED_CARDS) throw new Error(`You can keep up to ${MAX_WANTED_CARDS} card alerts.`);

  const data = parsed.data;
  await prisma.wantedCard.create({
    data: {
      userId: user.id,
      query: data.query,
      gradingCompany: data.gradingCompany,
      minGrade: data.gradingCompany === "RAW" ? null : data.minGrade,
      blackLabelOnly: data.gradingCompany === "BGS" && data.blackLabelOnly,
      maxPriceThb: data.maxPriceThb,
      trustedOnly: data.trustedOnly,
    },
  });
  revalidatePath("/portfolio");
}

export async function deleteWantedCard(wantedCardId: string) {
  const user = await getCurrentUser();
  await prisma.wantedCard.deleteMany({ where: { id: wantedCardId, userId: user.id } });
  revalidatePath("/portfolio");
}

// ---------------------------------------------------------------------------
// Card-for-card swaps. Only between two vaulted cards: both are already
// inspected and sitting in our warehouse, so a swap is an instant ownership
// change with no shipping or inspection round-trip. The optional cash
// difference goes through the same escrow program as a purchase.
// ---------------------------------------------------------------------------

type EscrowLockInput = { tradeId: string; txSignature: string; lamports: string; tradeAccount: string };

function assertSwappable(
  asset: { vaulted: boolean; redeemedAt: Date | null; marketStatus: string; name: string },
) {
  if (!asset.vaulted) throw new Error(`${asset.name} isn't in the vault — only vaulted cards can be swapped.`);
  if (asset.redeemedAt) throw new Error(`${asset.name} was redeemed and can't be swapped.`);
  if (asset.marketStatus === "IN_ESCROW" || asset.marketStatus === "IN_AUCTION") {
    throw new Error(`${asset.name} is in an active sale or auction.`);
  }
}

/**
 * Refunds a cash lock the client signed but that never got attached to a
 * trade (the server refused the swap after the wallet already locked it), so
 * a rejected request can't strand real funds on-chain.
 */
async function refundUnrecordedLock(lock: EscrowLockInput | undefined, payerWallet: string | null, assetId: string) {
  if (!lock) return;
  await releaseOrRefundEscrow(
    "refund",
    {
      onChain: true,
      onChainTradeId: BigInt(lock.tradeId),
      buyer: { walletAddress: payerWallet },
      seller: { walletAddress: null },
    },
    assetId,
  ).catch(() => {
    // Best-effort: the original error is what the user needs to see.
  });
}

/**
 * transferOwnership, but only attempts the real token move when the token is
 * verifiably in the sender's wallet. A card whose earlier transfer was
 * simulated has an approval on file but no token in that wallet, so a real
 * transfer could never succeed and would block the swap forever.
 */
async function transferForSwap(
  asset: { id: string; mintAddress: string | null; transferApproved: boolean },
  fromWallet: string | null,
  toWallet: string | null,
  toUserId: string,
) {
  let approved = asset.transferApproved;
  if (approved && asset.mintAddress && fromWallet) {
    const held = await isDigitalTwinHeldBy({ mintAddress: asset.mintAddress, ownerAddress: fromWallet });
    approved = held === true;
  }
  return transferOwnership({ ...asset, transferApproved: approved }, fromWallet, toWallet, toUserId);
}

const proposeTradeSchema = z.object({
  cashThb: z.number().int().min(-1_000_000).max(1_000_000),
  message: z.string().max(500).optional(),
});

/**
 * Proposes swapping one of your vaulted cards (plus optional cash either way)
 * for someone else's vaulted card. approveTxSignature is your real SPL
 * delegate approval over the offered card (so the platform can move it if the
 * swap is accepted); cashLock is your real escrow lock when you add cash.
 */
export async function proposeTrade(opts: {
  requestedAssetId: string;
  offeredAssetId: string;
  cashThb: number;
  message?: string;
  approveTxSignature?: string;
  cashLock?: EscrowLockInput;
}) {
  const user = await getCurrentUser();
  try {
    await createTradeProposal(user, opts);
  } catch (err) {
    await refundUnrecordedLock(opts.cashLock, user.walletAddress, opts.requestedAssetId);
    throw err;
  }
  revalidatePath("/portfolio");
}

async function createTradeProposal(
  user: Awaited<ReturnType<typeof getCurrentUser>>,
  opts: Parameters<typeof proposeTrade>[0],
) {
  if (user.isBanned) throw new Error("Your account is suspended and can't propose trades.");
  const parsed = proposeTradeSchema.safeParse({ cashThb: opts.cashThb, message: opts.message });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid trade.");
  const { cashThb, message } = parsed.data;

  const [requested, offered] = await Promise.all([
    prisma.asset.findUniqueOrThrow({ where: { id: opts.requestedAssetId } }),
    prisma.asset.findUniqueOrThrow({ where: { id: opts.offeredAssetId } }),
  ]);
  if (requested.ownerId === user.id) throw new Error("You already own this card.");
  if (offered.ownerId !== user.id) throw new Error("You can only offer a card you own.");
  assertSwappable(requested);
  assertSwappable(offered);

  const duplicate = await prisma.tradeOffer.findFirst({
    where: { proposerId: user.id, requestedAssetId: requested.id, offeredAssetId: offered.id, status: "PENDING" },
  });
  if (duplicate) throw new Error("You already proposed this exact swap.");

  if (offered.mintAddress && opts.approveTxSignature) {
    await prisma.asset.update({ where: { id: offered.id }, data: { transferApproved: true } });
  }

  const trade = await prisma.tradeOffer.create({
    data: {
      proposerId: user.id,
      recipientId: requested.ownerId,
      requestedAssetId: requested.id,
      offeredAssetId: offered.id,
      cashThb,
      message: message || null,
      cashOnChain: cashThb > 0 && Boolean(opts.cashLock),
      cashTradeId: cashThb > 0 && opts.cashLock ? BigInt(opts.cashLock.tradeId) : null,
      cashTradeAccount: cashThb > 0 ? (opts.cashLock?.tradeAccount ?? null) : null,
      cashLamports: cashThb > 0 && opts.cashLock ? BigInt(opts.cashLock.lamports) : null,
    },
  });

  const cashNote =
    cashThb > 0
      ? ` + ${cashThb.toLocaleString()} THB from them`
      : cashThb < 0
        ? ` if you add ${(-cashThb).toLocaleString()} THB`
        : "";
  await notifyUser(
    requested.ownerId,
    "TRADE_OFFER_RECEIVED",
    "New swap proposal",
    `${user.name ?? user.handle ?? "A collector"} offers ${offered.name}${cashNote} for your ${requested.name}.`,
    "/portfolio?tab=trades",
  );
  void trade;
}

async function loadTrade(tradeId: string) {
  return prisma.tradeOffer.findUniqueOrThrow({
    where: { id: tradeId },
    include: { proposer: true, recipient: true, requestedAsset: true, offeredAsset: true },
  });
}

/**
 * Recipient accepts or declines a swap. Accepting moves both digital twins,
 * settles the cash difference and swaps ownership of the two vaulted cards in
 * one step. approveTxSignature is the recipient's delegate approval over
 * their own card; cashLock is the recipient's escrow lock when the proposer
 * asked them to add cash (cashThb < 0).
 */
export async function respondToTrade(
  tradeId: string,
  action: "accept" | "reject",
  opts: { approveTxSignature?: string; cashLock?: EscrowLockInput } = {},
) {
  const user = await getCurrentUser();
  try {
    await resolveTrade(user, tradeId, action, opts);
  } catch (err) {
    // Only an accept ever carries a lock (the recipient paying cash); if the
    // swap didn't go through, give it straight back.
    await refundUnrecordedLock(opts.cashLock, user.walletAddress, tradeId);
    throw err;
  }
}

async function resolveTrade(
  user: Awaited<ReturnType<typeof getCurrentUser>>,
  tradeId: string,
  action: "accept" | "reject",
  opts: { approveTxSignature?: string; cashLock?: EscrowLockInput },
) {
  const trade = await loadTrade(tradeId);
  if (trade.recipientId !== user.id) throw new Error("This swap wasn't sent to you.");
  if (trade.status !== "PENDING") throw new Error("This swap has already been resolved.");

  if (action === "reject") {
    await refundTradeCash(trade);
    await prisma.tradeOffer.update({ where: { id: tradeId }, data: { status: "REJECTED", respondedAt: new Date() } });
    await notifyUser(
      trade.proposerId,
      "TRADE_OFFER_REJECTED",
      "Swap declined",
      `${user.name ?? user.handle ?? "The owner"} declined your swap for ${trade.requestedAsset.name}${trade.cashThb > 0 ? " — your cash was refunded" : ""}.`,
      "/portfolio?tab=trades",
    );
    revalidatePath("/portfolio");
    return;
  }

  await acceptTrade(user, trade, opts);
}

async function acceptTrade(
  user: Awaited<ReturnType<typeof getCurrentUser>>,
  trade: Awaited<ReturnType<typeof loadTrade>>,
  opts: { approveTxSignature?: string; cashLock?: EscrowLockInput },
) {
  const tradeId = trade.id;
  if (user.isBanned) throw new Error("Your account is suspended and can't trade.");
  const { requestedAsset, offeredAsset, proposer } = trade;
  const stillValid =
    requestedAsset.ownerId === user.id &&
    offeredAsset.ownerId === proposer.id &&
    [requestedAsset, offeredAsset].every(
      (a) => a.vaulted && !a.redeemedAt && a.marketStatus !== "IN_ESCROW" && a.marketStatus !== "IN_AUCTION",
    );
  if (!stillValid) {
    await refundTradeCash(trade);
    await prisma.tradeOffer.update({ where: { id: tradeId }, data: { status: "CANCELLED", respondedAt: new Date() } });
    revalidatePath("/portfolio");
    throw new Error("One of the cards is no longer available, so this swap was closed.");
  }

  // Both cards move first; cash is only released once they have.
  const requestedApproved = requestedAsset.transferApproved || Boolean(requestedAsset.mintAddress && opts.approveTxSignature);
  const toProposer = await transferForSwap(
    { ...requestedAsset, transferApproved: requestedApproved },
    user.walletAddress,
    proposer.walletAddress,
    proposer.id,
  );
  const toRecipient = await transferForSwap(offeredAsset, proposer.walletAddress, user.walletAddress, user.id);

  // Cash the recipient owes (the proposer asked for cash) was locked by the
  // recipient's wallet just before this call; the swap is instant, so it's
  // released straight away.
  let recipientCash: { signature: string; onChain: boolean } | null = null;
  if (trade.cashThb < 0) {
    recipientCash = await releaseOrRefundEscrow(
      "release",
      {
        onChain: Boolean(opts.cashLock),
        onChainTradeId: opts.cashLock ? BigInt(opts.cashLock.tradeId) : null,
        buyer: { walletAddress: user.walletAddress },
        seller: { walletAddress: proposer.walletAddress },
      },
      requestedAsset.id,
    );
  }

  let proposerCash: { signature: string; onChain: boolean } | null = null;
  if (trade.cashThb > 0) {
    proposerCash = await releaseOrRefundEscrow(
      "release",
      {
        onChain: trade.cashOnChain,
        onChainTradeId: trade.cashTradeId,
        buyer: { walletAddress: proposer.walletAddress },
        seller: { walletAddress: user.walletAddress },
      },
      requestedAsset.id,
    );
  }

  const swappedData = { forSale: false, marketStatus: "IN_VAULT" as const, transferApproved: false };
  await prisma.$transaction([
    prisma.asset.update({ where: { id: requestedAsset.id }, data: { ...swappedData, ownerId: proposer.id } }),
    prisma.asset.update({ where: { id: offeredAsset.id }, data: { ...swappedData, ownerId: user.id } }),
    prisma.tradeOffer.update({ where: { id: tradeId }, data: { status: "ACCEPTED", respondedAt: new Date() } }),
  ]);

  const cashText =
    trade.cashThb > 0
      ? ` plus ${trade.cashThb.toLocaleString()} THB paid by ${proposer.name ?? "the proposer"}`
      : trade.cashThb < 0
        ? ` plus ${(-trade.cashThb).toLocaleString()} THB paid by ${user.name ?? "the owner"}`
        : "";
  await prisma.provenanceEvent.createMany({
    data: [
      {
        assetId: requestedAsset.id,
        type: "SWAPPED",
        note: `Swapped for ${offeredAsset.name}${cashText}. Ownership moved to ${proposer.name ?? "the proposer"}.`,
        mockTxSignature: toProposer.signature,
        onChain: toProposer.onChain,
        actorId: user.id,
      },
      {
        assetId: offeredAsset.id,
        type: "SWAPPED",
        note: `Swapped for ${requestedAsset.name}${cashText}. Ownership moved to ${user.name ?? "the owner"}.`,
        mockTxSignature: toRecipient.signature,
        onChain: toRecipient.onChain,
        actorId: user.id,
      },
    ],
  });
  void recipientCash;
  void proposerCash;

  await cancelTradesInvolving(requestedAsset.id, tradeId);
  await cancelTradesInvolving(offeredAsset.id, tradeId);
  await notifyUser(
    proposer.id,
    "TRADE_OFFER_ACCEPTED",
    "Swap complete",
    `${user.name ?? user.handle ?? "The owner"} accepted — ${requestedAsset.name} is now yours.`,
    `/item/${requestedAsset.id}`,
  );

  revalidateMarketplace(requestedAsset.id);
  revalidateMarketplace(offeredAsset.id);
}

/** Proposer withdraws their own pending swap; any cash they locked is refunded. */
export async function withdrawTrade(tradeId: string) {
  const user = await getCurrentUser();
  const trade = await loadTrade(tradeId);
  if (trade.proposerId !== user.id) throw new Error("This isn't your swap proposal.");
  if (trade.status !== "PENDING") throw new Error("This swap has already been resolved.");

  await refundTradeCash(trade);
  await prisma.tradeOffer.update({ where: { id: tradeId }, data: { status: "WITHDRAWN", respondedAt: new Date() } });
  revalidatePath("/portfolio");
}

// ---------------------------------------------------------------------------
// Identity verification (KYC). Users submit their details; staff review them
// by hand from the back office. No ID document image is stored — see the
// comment on User.kycStatus in schema.prisma.
// ---------------------------------------------------------------------------

const kycSchema = z.object({
  legalName: z.string().trim().min(3, "Enter your full legal name.").max(120),
  dateOfBirth: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "Enter your date of birth.")
    .refine((v) => {
      const dob = new Date(v);
      const eighteen = new Date(dob.getFullYear() + 18, dob.getMonth(), dob.getDate());
      return eighteen <= new Date();
    }, "You must be at least 18 to verify your identity."),
  idType: z.enum(["NATIONAL_ID", "PASSPORT", "DRIVING_LICENSE"]),
  idNumber: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9 -]{5,20}$/, "Enter a valid ID number."),
  consent: z.literal("on", { message: "Confirm the details are yours and accurate." }),
});

export interface KycState {
  error?: string;
  ok?: boolean;
}

export async function submitKyc(_prev: KycState, formData: FormData): Promise<KycState> {
  const user = await getCurrentUser();
  if (user.kycStatus === "VERIFIED") return { error: "Your identity is already verified." };
  if (user.kycStatus === "PENDING") return { error: "Your verification is already under review." };

  const parsed = kycSchema.safeParse({
    legalName: formData.get("legalName"),
    dateOfBirth: formData.get("dateOfBirth"),
    idType: formData.get("idType"),
    idNumber: formData.get("idNumber"),
    consent: formData.get("consent"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  const data = parsed.data;
  const idDigits = data.idNumber.replace(/[\s-]/g, "");

  await prisma.user.update({
    where: { id: user.id },
    data: {
      kycStatus: "PENDING",
      kycLegalName: data.legalName,
      kycDateOfBirth: new Date(data.dateOfBirth),
      kycIdType: data.idType as KycIdType,
      // Only the last 4 characters are ever stored.
      kycIdLast4: idDigits.slice(-4),
      kycSubmittedAt: new Date(),
      kycReviewedAt: null,
      kycRejectReason: null,
    },
  });
  await notifyAdmins(
    "KYC_SUBMITTED",
    "Identity verification submitted",
    `${user.name ?? user.handle ?? "A user"} submitted their identity for review.`,
    "/admin/warehouse?tab=kyc",
  );

  revalidatePath("/portfolio");
  revalidatePath("/admin/warehouse");
  return { ok: true };
}

export async function reviewKyc(userId: string, action: "approve" | "reject", reason?: string) {
  await requireAdmin();
  const target = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (target.kycStatus !== "PENDING") throw new Error("This verification isn't awaiting review.");

  if (action === "approve") {
    await prisma.user.update({
      where: { id: userId },
      data: { kycStatus: "VERIFIED", kycReviewedAt: new Date(), kycRejectReason: null },
    });
    await notifyUser(
      userId,
      "KYC_APPROVED",
      "Identity verified",
      "Your identity is verified. Buyers now see an ID-verified badge on your store and listings.",
      "/portfolio",
    );
  } else {
    const trimmed = reason?.trim().slice(0, 300) || "The details couldn't be confirmed.";
    await prisma.user.update({
      where: { id: userId },
      data: { kycStatus: "REJECTED", kycReviewedAt: new Date(), kycRejectReason: trimmed },
    });
    await notifyUser(userId, "KYC_REJECTED", "Identity verification declined", `${trimmed} You can submit again.`, "/portfolio");
  }

  revalidatePath("/admin/warehouse");
  revalidatePath(`/store/${userId}`);
}

/** Admin-only live check of the PSA, eBay and TCG APIs (see lib/integrations.ts). */
export async function runIntegrationCheck() {
  await requireAdmin();
  return checkAllIntegrations();
}
