"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
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
import { isDigitalTwinHeldBy, isTransferDelegated, mintDigitalTwinToken, transferDigitalTwinToken } from "@/lib/web3/token-server";
import { FULL_SERVICE_PACKAGE_PRICE_THB, THB_PER_USD, buyerFeeThb, thbToLamports } from "@/lib/pricing";
import { lookupEbayPrice, type EbayPriceQuote } from "@/lib/ebay";
import { verifyEscrowLock, verifyServiceFee } from "@/lib/web3/escrow-verify";
import { sendFromPlatform } from "@/lib/web3/escrow-server";
import { deriveTradePda } from "@/lib/web3/escrow-program";
import { address } from "@solana/kit";
import { isOwnUploadUrl, photoUrlProblem, psaCertMismatch } from "@/lib/listing-checks";
import { themeIndexForSerial } from "@/lib/theme";
import { getVerificationChecklist } from "@/lib/verification-checklist";
import { BGS_BLACK_LABEL_GRADE, gradeTierLabel } from "@/lib/labels";
import { bidAmountProblem } from "@/lib/auction-rules";
import { requestDevnetAirdrop } from "@/lib/solana";
import { runMandate, runMandatesForListing, withdrawAgentOffers } from "@/lib/agent/engine";
import { taskReportText } from "@/lib/agent/report";
import { agentLockPayment, isAgentChainEnabled } from "@/lib/agent/wallet";
import { EMAILED_NOTIFICATION_TYPES, isEmailConfigured, sendEmail } from "@/lib/email";
import { checkAllIntegrations } from "@/lib/integrations";
import {
  DISPUTE_WINDOW_DAYS,
  SELLER_SHIP_DAYS,
  isWithinDisputeWindow,
  packageReference,
  sellerShipByDeadline,
} from "@/lib/shipping";
import { findCatalogCard } from "@/lib/card-catalog";
import { checkKycPhoto, deleteKycPhotos, isKycPhotoStorageConfigured, saveKycPhoto } from "@/lib/kyc-storage";
import { getPortfolioPriceHistory, type PriceHistoryRange } from "@/lib/queries";
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
  revalidatePath("/admin", "layout");
  if (assetId) revalidatePath(`/item/${assetId}`);
}

// Real notifications only, fired at the moment something real actually
// happens elsewhere in this file (an item sold, a grade came back, etc.) —
// never backfilled or synthesized after the fact. notifyUser is for a
// specific buyer/seller; notifyAdmins broadcasts to every isAdmin user by
// leaving userId unset, since staff alerts aren't addressed to one person.
// The important ones are also emailed (lib/email.ts) — after the response,
// so a slow or failed email never holds up or breaks the action itself.
async function notifyUser(userId: string, type: NotificationType, title: string, body: string, href?: string) {
  await prisma.notification.create({
    data: { audience: "USER", userId, type, title, body, href },
  });
  if (EMAILED_NOTIFICATION_TYPES.has(type)) emailUser(userId, title, body, href);
}

function emailUser(userId: string, title: string, body: string, href?: string) {
  if (!isEmailConfigured()) return;
  after(async () => {
    const recipient = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (recipient?.email) await sendEmail(recipient.email, title, body, href);
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
    // Pokémon and One Piece only — both are trading cards.
    category: z.literal("TRADING_CARD"),
    game: z.enum(["POKEMON", "ONE_PIECE"]),
    language: z.enum(["ENGLISH", "JAPANESE"]).default("ENGLISH"),
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
    cardNumber: z.string().trim().max(24).optional(),
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

/**
 * Tells staff about a listing that's live but looks off: a card the catalogue
 * doesn't recognise, or a price far below what the exact same card asks on
 * eBay (a classic too-good-to-be-true scam). Runs after the response, and
 * only flags — the warehouse inspection is still what releases any payment.
 */
function flagUnusualListing(
  asset: { id: string; name: string; subtitle: string; cardNumber: string | null; gradingCompany: GradingCompany; grade: number | null; isBlackLabel: boolean; priceThb: number | null },
  inCatalog: boolean,
  sellerName: string,
) {
  after(async () => {
    const reasons: string[] = [];
    // Raw cards can be anything — promos, misprints, odd sets — and their
    // price swings with condition, so only graded slabs get flagged.
    if (asset.gradingCompany === "RAW") return;
    if (!inCatalog) reasons.push("the card catalogue doesn't recognise this card and set");
    const ebay = await lookupEbayPrice(asset).catch(() => null);
    if (ebay && ebay.itemCount >= 3 && asset.priceThb != null) {
      const marketThb = Math.round(ebay.medianPriceUsd * THB_PER_USD);
      if (asset.priceThb < marketThb * SUSPICIOUS_PRICE_RATIO) {
        reasons.push(`it's priced at ${asset.priceThb.toLocaleString()} THB, far below the ${marketThb.toLocaleString()} THB the same card asks on eBay`);
      }
    }
    if (reasons.length === 0) return;
    await notifyAdmins(
      "SUSPICIOUS_LISTING",
      "Listing worth a look",
      `${sellerName} listed "${asset.name}" — ${reasons.join("; and ")}.`,
      `/item/${asset.id}`,
    );
  });
}

// Below this share of the exact card's eBay median, a price is worth a look.
const SUSPICIOUS_PRICE_RATIO = 0.4;

/** A twin's on-chain NFT name, grade first so it survives the 32-byte cut: "PSA 10 · Lugia Holo 1st Edition". */
function nftName(cardName: string, gradingCompany: string, grade: number | null): string {
  const tier = gradingCompany === "RAW" || grade == null ? "Raw" : `${gradingCompany} ${Number.isInteger(grade) ? grade : grade.toFixed(1)}`;
  return `${tier} · ${cardName}`;
}

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
    game: formData.get("game"),
    language: formData.get("language") || undefined,
    raw: formData.get("raw"),
    gradingCompany: formData.get("gradingCompany"),
    grade: formData.get("grade") || undefined,
    isBlackLabel: formData.get("isBlackLabel") || undefined,
    serial: formData.get("serial") || undefined,
    cardNumber: formData.get("cardNumber") || undefined,
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

  // Photos must be fresh captures uploaded here — not outside links, and not
  // lifted from another listing.
  const photoUrls = data.photos.map((p) => p.url);
  const photoProblem = photoUrlProblem(photoUrls);
  if (photoProblem) return { error: photoProblem };
  const reused = await prisma.verificationPhoto.findFirst({ where: { url: { in: photoUrls } }, select: { assetId: true } });
  if (reused) {
    await notifyAdmins(
      "SUSPICIOUS_LISTING",
      "Reused verification photos",
      `${user.name ?? user.handle ?? "A user"} tried to list "${data.name}" with photos already used on another listing.`,
      `/item/${reused.assetId}`,
    );
    return { error: "These photos are already used on another listing. Take new ones of this card." };
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
    // A real cert has to be THIS card, or a cheap slab's cert could sell a pricier card.
    if (result.ok) {
      const mismatch = psaCertMismatch(result.cert, data);
      if (mismatch) return { error: mismatch };
      if (!data.cardNumber && result.cert.cardNumber) data.cardNumber = result.cert.cardNumber;
    }
  }

  // Real, server-signed mint (a genuine SPL Token, decimals 0, fixed supply
  // of 1 — see lib/web3/token-server.ts). Whenever the escrow/platform
  // authority is configured, every listing gets a real NFT in the seller's
  // wallet or isn't created at all — never a silent simulated mint. Only a
  // local setup with no authority key falls back to the simulated mint. No
  // client wallet interaction is needed for minting itself — the seller
  // signs afterward, once, to approve a future transfer (see
  // confirmListingApproval + self-mint-form.tsx).
  const authorityAddress = await getEscrowAuthorityAddress();
  let mintTxSignature: string;
  let isOnChain: boolean;
  let mintAddress: string | null = null;
  if (authorityAddress) {
    if (!user.walletAddress) {
      return { error: "Your Solana wallet isn't ready yet. Refresh the page in a few seconds and try again." };
    }
    try {
      const minted = await mintDigitalTwinToken({
        ownerAddress: user.walletAddress,
        name: nftName(data.name, data.raw ? "RAW" : data.gradingCompany, data.raw ? null : (data.grade ?? null)),
      });
      mintTxSignature = minted.txSignature;
      mintAddress = minted.mintAddress;
    } catch (err) {
      console.error("Digital twin mint failed", err);
      return { error: "We couldn't mint this card's NFT on Solana just now. Nothing was charged — please try again." };
    }
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
      cardNumber: data.cardNumber || null,
      category: data.category as AssetCategory,
      game: data.game,
      language: data.language,
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

  // Official reference image so buyers recognise the card at a glance, and
  // its card number if the seller left that blank — best-effort, one API
  // call per listing; a miss just leaves the artwork.
  const catalog = await findCatalogCard({ name: data.name, subtitle: data.subtitle, game: data.game });
  if (catalog) {
    await prisma.asset.update({
      where: { id: asset.id },
      data: { catalogImageUrl: catalog.imageUrl, ...(!data.cardNumber && catalog.number ? { cardNumber: catalog.number } : {}) },
    });
  }

  flagUnusualListing(asset, Boolean(catalog), user.name ?? user.handle ?? "A user");
  await notifyWantedCardMatches(asset.id);
  triggerAgentsForListing(asset.id);

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
  if (!(await onChainTransferApproved(asset, user.walletAddress))) {
    throw new Error("We can't see your approval on-chain yet. Wait a few seconds and try again.");
  }

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
  /** The wallet that signed the lock, when it isn't the buyer's own (the buying agent). */
  payerWalletAddress?: string;
  /** Charge the buyer-protection fee (BUYER_FEE_PERCENT) — Buy Now, accepted offers, agent buys. */
  chargeFee?: boolean;
  /**
   * The lock was already verified and recorded (an auction's winning bid,
   * checked in placeBid), so skip verifyEscrowLock — its "not already used"
   * check would otherwise refuse the bid's own lock.
   */
  lockAlreadyVerified?: boolean;
}): Promise<{ escrowTxId: string }> {
  const { asset, user, priceThb, fulfillmentChoice, escrowLock, soldNote, purchasedNote, payerWalletAddress } = opts;
  const serviceFeeThb = opts.chargeFee ? buyerFeeThb(priceThb) : 0;
  let serviceFeeLamports: bigint | null = null;
  const assetId = asset.id;

  // Real on-chain lock when the buyer actually signed one (see
  // components/item/buy-panel.tsx) — falls back to the old simulated
  // signature otherwise, same pattern as everywhere else real signing was
  // added this session.
  if (asset.redeemedAt) throw new Error("This item was redeemed and is no longer tradeable.");
  if (escrowLock && !opts.lockAlreadyVerified) {
    const payer = payerWalletAddress ?? user.walletAddress;
    if (!payer) throw new Error("Your account has no wallet to pay from.");
    await verifyEscrowLock(escrowLock, { buyer: payer, seller: asset.owner.walletAddress, minLamports: thbToLamports(priceThb) });
    const platform = serviceFeeThb > 0 ? await getEscrowAuthorityAddress() : null;
    if (platform) {
      serviceFeeLamports = await verifyServiceFee(escrowLock, {
        buyer: payer,
        platform,
        minLamports: thbToLamports(serviceFeeThb),
      });
    }
  }
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
      payerWalletAddress: payerWalletAddress ?? null,
      serviceFeeThb,
      serviceFeeLamports,
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
        payerWalletAddress,
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
    // The seller now has to actually send the card in (markShippedToWarehouse)
    // before it reaches the inspection queue — until then the buyer's money
    // sits in escrow, and it's refunded if the deadline passes
    // (expireOverdueSellerShipments).
    await prisma.asset.update({
      where: { id: assetId },
      data: {
        forSale: false,
        marketStatus: "IN_ESCROW",
        pipelineStage: "AWAITING_SELLER_SHIPMENT",
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
        status: "AWAITING_SELLER_SHIPMENT",
        shipByDeadline: sellerShipByDeadline(),
      },
    });
    await notifyUser(
      asset.ownerId,
      "SELLER_SHIP_REQUIRED",
      "Sold! Ship it to CardMart",
      `${asset.name} sold for ${priceThb.toLocaleString()} THB. Send it to our warehouse and add the tracking number within ${SELLER_SHIP_DAYS} days, or the sale is cancelled and the buyer refunded.`,
      "/portfolio",
    );
    await notifyUser(user.id, "ITEM_PURCHASED", "Purchase confirmed", purchasedNote, `/item/${assetId}`);
  }

  await cancelTradesInvolving(assetId);
  revalidateMarketplace(assetId);
  return { escrowTxId: escrowTx.id };
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
  try {
    await buyListingAs(user, assetId, fulfillmentChoice, escrowLock);
  } catch (err) {
    await refundRejectedPurchase(escrowLock, user.walletAddress, assetId);
    throw err;
  }
}

async function buyListingAs(
  user: Awaited<ReturnType<typeof getCurrentUser>>,
  assetId: string,
  fulfillmentChoice: "SHIP" | "VAULT",
  escrowLock?: EscrowLockInput,
) {
  if (user.isBanned) throw new Error("Your account is suspended and can't make purchases.");
  const asset = await prisma.asset.findUniqueOrThrow({ where: { id: assetId }, include: { owner: true } });

  if (!asset.forSale || asset.priceThb == null) {
    throw new Error("This item is not currently for sale.");
  }
  if (asset.ownerId === user.id) {
    throw new Error("You already own this item.");
  }
  if (!escrowLock && (await realEscrowRequired(asset.owner.walletAddress, user.walletAddress))) {
    throw new Error("Pay with your wallet to buy this card — the payment goes into escrow.");
  }
  await assertNftCanMove(asset, asset.owner.walletAddress);

  await completePurchase({
    asset,
    user,
    priceThb: asset.priceThb,
    fulfillmentChoice,
    escrowLock,
    chargeFee: true,
    soldNote: `${asset.name} sold instantly from your vault for ${asset.priceThb.toLocaleString()} THB.`,
    purchasedNote: asset.vaulted
      ? `${asset.name} is yours — ownership transferred instantly from the vault.`
      : `${asset.name} — your payment of ${asset.priceThb.toLocaleString()} THB is held safely until warehouse inspection passes.`,
  });
}

// ---------------------------------------------------------------------------
// Auctions — a separate sale channel from the fixed-price marketplace above.
// No cron/background job settles these: expiry is checked lazily wherever an
// auction is read (see getActiveAuctions/getAuctionById in lib/queries.ts)
// and by settleAuction below. Every bid locks its amount in escrow, so the
// winning bid is always backed by real money — see placeBid.
// ---------------------------------------------------------------------------

const ANTI_SNIPING_WINDOW_MS = 5 * 60_000;
const ANTI_SNIPING_EXTENSION_MS = 5 * 60_000;

const startAuctionSchema = z.object({
  startPriceThb: z.coerce.number().int().min(100),
  durationDays: z.coerce.number().int().min(1).max(14),
  startTime: z.string().datetime().optional(),
});

/**
 * What the seller's wallet must approve before this card can be auctioned:
 * the platform as delegate for its NFT, so the winner's NFT can move when
 * the auction ends. Null when nothing is needed (no real NFT, escrow not
 * configured, a legacy card whose NFT isn't in this wallet, or already
 * approved).
 */
export async function auctionApprovalNeeded(assetId: string): Promise<{ mintAddress: string; delegate: string } | null> {
  const user = await getCurrentUser();
  const asset = await prisma.asset.findUnique({ where: { id: assetId }, select: { ownerId: true, mintAddress: true } });
  if (!asset || asset.ownerId !== user.id || !asset.mintAddress || !user.walletAddress) return null;
  const delegate = await getEscrowAuthorityAddress();
  if (!delegate) return null;
  if ((await isDigitalTwinHeldBy({ mintAddress: asset.mintAddress, ownerAddress: user.walletAddress })) === false) return null;
  if (await onChainTransferApproved(asset, user.walletAddress, { retry: false })) return null;
  return { mintAddress: asset.mintAddress, delegate };
}

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

  // The winner's NFT has to be movable when the auction ends, so a card with
  // a real NFT needs its owner's on-chain approval before bidding opens.
  const transferApproved = await onChainTransferApproved(asset, user.walletAddress);
  if (!transferApproved && (await auctionApprovalNeeded(assetId))) {
    throw new Error("Approve the card's NFT transfer in your wallet to start the auction.");
  }

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
      data: { forSale: false, marketStatus: "IN_AUCTION", transferApproved },
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

// A winner of a non-vaulted item gets this long after bidding closes to
// choose ship or vault — their money is already locked, so if they don't,
// the item simply goes to the vault for them.
const CLAIM_WINDOW_MS = 48 * 3_600_000;

type BidWithBidder = Prisma.BidGetPayload<{ include: { bidder: true } }>;

/**
 * Returns a bid's locked funds to the bidder (outbid, or swept up at
 * settlement). Claims the refund in the DB first so two concurrent callers
 * can't both refund; if the real on-chain refund fails, the bid goes back to
 * HELD so the next settleAuction sweep retries it.
 */
async function refundBidLock(bid: BidWithBidder, assetId: string) {
  if (bid.lockStatus !== "HELD") return;
  const claimed = await prisma.bid.updateMany({ where: { id: bid.id, lockStatus: "HELD" }, data: { lockStatus: "REFUNDED" } });
  if (claimed.count === 0) return;
  try {
    await releaseOrRefundEscrow(
      "refund",
      {
        onChain: bid.onChain,
        onChainTradeId: bid.onChainTradeId,
        buyer: { walletAddress: bid.bidder.walletAddress },
        seller: { walletAddress: null },
      },
      assetId,
    );
  } catch (err) {
    await prisma.bid.update({ where: { id: bid.id }, data: { lockStatus: "HELD" } });
    console.error(`Refund of bid ${bid.id} failed; will retry at settlement.`, err);
  }
}

/**
 * Buyer places a bid — at least the start price (first bid) or the current
 * highest plus one step, and on a step (see lib/auction-rules.ts). The bid's full amount is
 * locked in escrow by the bidder's own wallet signature before this runs
 * (components/auction/bid-panel.tsx), so a winning bid is always backed by
 * real money. Any rejection below refunds that lock straight away.
 */
export async function placeBid(auctionId: string, amountThb: number, bidLock?: EscrowLockInput) {
  const user = await getCurrentUser();
  const reject = async (message: string): Promise<never> => {
    await refundUnrecordedLock(bidLock, user.walletAddress, auctionId);
    throw new Error(message);
  };

  if (user.isBanned) return reject("Your account is suspended and can't bid.");
  const parsed = placeBidSchema.safeParse({ amountThb });
  if (!parsed.success) return reject("Enter a valid bid amount.");
  const amount = parsed.data.amountThb;

  const auction = await prisma.auction.findUniqueOrThrow({ where: { id: auctionId }, include: { asset: true } });
  if (auction.asset.ownerId === user.id) return reject("You can't bid on your own item.");
  const now = new Date();
  if (auction.startTime > now) return reject("This auction has not started yet.");
  if (auction.status !== "ACTIVE" || auction.endTime <= now) return reject("This auction has ended.");

  const amountProblem = bidAmountProblem(amount, auction);
  if (amountProblem) return reject(amountProblem);
  if (bidLock && BigInt(bidLock.lamports) !== thbToLamports(amount)) {
    return reject("The locked amount doesn't match your bid. Try again.");
  }
  const sellerWallet = (await prisma.user.findUnique({ where: { id: auction.asset.ownerId }, select: { walletAddress: true } }))?.walletAddress ?? null;
  if (!bidLock && (await realEscrowRequired(sellerWallet, user.walletAddress))) {
    return reject("Lock your bid with your wallet — every bid is held in escrow.");
  }
  if (bidLock) {
    try {
      await verifyEscrowLock(bidLock, { buyer: user.walletAddress!, seller: sellerWallet, minLamports: thbToLamports(amount) });
    } catch (err) {
      return reject(err instanceof Error ? err.message : "Your bid lock couldn't be verified.");
    }
  }

  const shouldExtend = auction.endTime.getTime() - now.getTime() <= ANTI_SNIPING_WINDOW_MS;
  const extendedEndTime = shouldExtend ? new Date(auction.endTime.getTime() + ANTI_SNIPING_EXTENSION_MS) : auction.endTime;

  // Only write if nobody else bid since we read the auction — two bidders
  // racing for the top would otherwise both "win" with locked funds.
  const placed = await prisma.$transaction(async (tx) => {
    const res = await tx.auction.updateMany({
      where: { id: auctionId, status: "ACTIVE", currentBidThb: auction.currentBidThb },
      data: { currentBidThb: amount, ...(shouldExtend ? { endTime: extendedEndTime } : {}) },
    });
    if (res.count === 0) return null;
    return tx.bid.create({
      data: {
        auctionId,
        bidderId: user.id,
        amountThb: amount,
        lockStatus: "HELD",
        onChain: Boolean(bidLock),
        onChainTradeId: bidLock ? BigInt(bidLock.tradeId) : null,
        tradeAccount: bidLock?.tradeAccount ?? null,
        lamportsLocked: bidLock ? BigInt(bidLock.lamports) : null,
        lockTxSignature: bidLock?.txSignature ?? null,
      },
    });
  });
  if (!placed) return reject("Someone else just bid. Refresh to see the new price and try again.");

  // Everyone else's standing lock on this auction — including this bidder's
  // own previous, lower bid — goes back to them now.
  const outbid = await prisma.bid.findMany({
    where: { auctionId, lockStatus: "HELD", id: { not: placed.id } },
    include: { bidder: true },
  });
  for (const bid of outbid) {
    await refundBidLock(bid, auction.assetId);
    if (bid.bidderId !== user.id) {
      await notifyUser(
        bid.bidderId,
        "OUTBID",
        "You've been outbid",
        `Someone bid ${amount.toLocaleString()} THB on ${auction.asset.name}. Your ${bid.amountThb.toLocaleString()} THB lock has been returned.`,
        `/auctions/${auctionId}`,
      );
    }
  }

  revalidatePath(`/auctions/${auctionId}`);
  revalidatePath("/auctions");
  return { extended: shouldExtend, endTime: extendedEndTime.toISOString() };
}

type AuctionForSettlement = Prisma.AuctionGetPayload<{
  include: { asset: { include: { owner: true } }; bids: { include: { bidder: true } } };
}>;

async function loadAuctionForSettlement(auctionId: string): Promise<AuctionForSettlement | null> {
  return prisma.auction.findUnique({
    where: { id: auctionId },
    include: { asset: { include: { owner: true } }, bids: { orderBy: { amountThb: "desc" }, include: { bidder: true } } },
  });
}

/**
 * Turns the winning bid into the sale. A locked bid's own escrow lock is
 * reused as the purchase escrow (no second payment); a legacy unlocked bid
 * passes the lock the winner just signed in claimAuctionWin instead.
 */
async function finalizeAuctionSale(
  auction: AuctionForSettlement,
  top: BidWithBidder,
  fulfillmentChoice: "SHIP" | "VAULT",
  legacyLock?: EscrowLockInput,
) {
  const claimed = await prisma.auction.updateMany({
    where: { id: auction.id, status: "ACTIVE" },
    data: { status: "ENDED_SOLD", settledAt: new Date() },
  });
  if (claimed.count === 0) throw new Error("This auction has already been settled.");

  const escrowLock: EscrowLockInput | undefined =
    top.lockStatus === "HELD"
      ? top.onChain && top.onChainTradeId != null
        ? {
            tradeId: top.onChainTradeId.toString(),
            txSignature: top.lockTxSignature ?? "",
            lamports: (top.lamportsLocked ?? BigInt(0)).toString(),
            tradeAccount: top.tradeAccount ?? "",
          }
        : undefined
      : legacyLock;
  if (top.lockStatus === "HELD") await prisma.bid.update({ where: { id: top.id }, data: { lockStatus: "CONVERTED" } });

  // completePurchase's vaulted branch only ever touches ownerId/forSale, not
  // marketStatus — reset it back from IN_AUCTION to IN_VAULT first so a
  // vaulted win doesn't get stuck reading "Up for Auction" forever.
  if (auction.asset.vaulted) {
    await prisma.asset.update({ where: { id: auction.assetId }, data: { marketStatus: "IN_VAULT" } });
  }

  try {
    await completePurchase({
      asset: auction.asset,
      user: top.bidder,
      priceThb: top.amountThb,
      fulfillmentChoice,
      escrowLock,
      lockAlreadyVerified: top.lockStatus === "HELD",
      soldNote: `${auction.asset.name} sold at auction for ${top.amountThb.toLocaleString()} THB.`,
      purchasedNote: `You won the auction for ${auction.asset.name} at ${top.amountThb.toLocaleString()} THB.`,
    });
  } catch (err) {
    // Put everything back so the next settle/claim can retry — the winner's
    // money is still locked, nothing moved.
    await prisma.auction.update({ where: { id: auction.id }, data: { status: "ACTIVE", settledAt: null } });
    if (top.lockStatus === "HELD") await prisma.bid.update({ where: { id: top.id }, data: { lockStatus: "HELD" } });
    if (auction.asset.vaulted) {
      await prisma.asset.update({ where: { id: auction.assetId }, data: { marketStatus: "IN_AUCTION" } });
    }
    throw err;
  }

  await notifyUser(
    top.bidderId,
    "AUCTION_WON",
    "You won the auction",
    `You won ${auction.asset.name} for ${top.amountThb.toLocaleString()} THB.`,
    `/auctions/${auction.id}`,
  );
  revalidatePath(`/auctions/${auction.id}`);
  revalidatePath("/auctions");
}

/**
 * Settles an auction whose bidding has closed. Safe for anyone to call, any
 * number of times — it only acts when something is actually due, which is
 * how auctions settle without a cron job (components/auction/auto-settle.tsx
 * calls it from the auction pages):
 *   - outbid locks that failed to refund earlier are retried;
 *   - a vaulted item's sale completes straight away (nothing to choose);
 *   - a non-vaulted item waits CLAIM_WINDOW_MS for the winner to choose
 *     ship or vault, then defaults to the vault;
 *   - a legacy winning bid with no lock that's never claimed within the
 *     window ends ENDED_UNCLAIMED and the item goes back to the seller.
 */
export async function settleAuction(auctionId: string): Promise<{ settled: boolean }> {
  const auction = await loadAuctionForSettlement(auctionId);
  if (!auction || auction.status !== "ACTIVE" || auction.endTime > new Date()) return { settled: false };
  const [top, ...rest] = auction.bids;
  if (!top) return { settled: false }; // no-bid expiry: lib/queries.ts settleIfExpiredNoBids

  for (const bid of rest) await refundBidLock(bid, auction.assetId);

  const deadline = auction.claimDeadline ?? new Date(auction.endTime.getTime() + CLAIM_WINDOW_MS);
  const needsChoice = top.lockStatus == null || !auction.asset.vaulted;
  if (needsChoice && !auction.claimDeadline) {
    const opened = await prisma.auction.updateMany({
      where: { id: auctionId, claimDeadline: null },
      data: { claimDeadline: deadline },
    });
    if (opened.count > 0) {
      await notifyUser(
        top.bidderId,
        "AUCTION_WON",
        "You won — choose delivery",
        top.lockStatus == null
          ? `You won ${auction.asset.name} for ${top.amountThb.toLocaleString()} THB. Complete payment by ${deadline.toLocaleString()} or the win lapses.`
          : `You won ${auction.asset.name} for ${top.amountThb.toLocaleString()} THB. Choose ship or vault by ${deadline.toLocaleString()} — otherwise it goes to the vault for you.`,
        `/auctions/${auctionId}`,
      );
      await notifyUser(
        auction.asset.ownerId,
        "AUCTION_ENDED_SELLER",
        "Your auction ended",
        `${auction.asset.name} sold for ${top.amountThb.toLocaleString()} THB — waiting on the winner's delivery choice.`,
        `/auctions/${auctionId}`,
      );
    }
  }
  if (needsChoice && deadline > new Date()) {
    if (rest.length > 0) revalidatePath(`/auctions/${auctionId}`);
    return { settled: false };
  }

  if (top.lockStatus == null) {
    const lapsed = await prisma.auction.updateMany({
      where: { id: auctionId, status: "ACTIVE" },
      data: { status: "ENDED_UNCLAIMED", settledAt: new Date() },
    });
    if (lapsed.count === 0) return { settled: false };
    await prisma.asset.update({
      where: { id: auction.assetId },
      data: { marketStatus: auction.asset.vaulted ? "IN_VAULT" : "DELISTED" },
    });
    await notifyUser(
      auction.asset.ownerId,
      "AUCTION_ENDED_SELLER",
      "Winner didn't claim",
      `The winning bidder didn't pay for ${auction.asset.name} in time. It's back in your portfolio to relist.`,
      `/item/${auction.assetId}`,
    );
    revalidateMarketplace(auction.assetId);
    revalidatePath(`/auctions/${auctionId}`);
    revalidatePath("/auctions");
    return { settled: true };
  }

  await finalizeAuctionSale(auction, top, "VAULT");
  return { settled: true };
}

/**
 * The winning bidder completes a finished auction. With a locked bid the
 * money is already in escrow, so this is only the ship-or-vault choice. A
 * legacy unlocked bid still has to lock payment here, like any purchase.
 */
export async function claimAuctionWin(
  auctionId: string,
  fulfillmentChoice: "SHIP" | "VAULT",
  escrowLock?: EscrowLockInput,
) {
  const user = await getCurrentUser();
  const auction = await loadAuctionForSettlement(auctionId);
  const top = auction?.bids[0];
  const fail = async (message: string): Promise<never> => {
    if (top?.lockStatus == null) await refundUnrecordedLock(escrowLock, user.walletAddress, auctionId);
    throw new Error(message);
  };
  if (!auction) return fail("Auction not found.");
  if (user.isBanned) return fail("Your account is suspended and can't complete a purchase.");
  if (auction.status !== "ACTIVE" || auction.endTime > new Date()) return fail("This auction isn't waiting on a claim.");
  if (!top) return fail("This auction ended with no bids.");
  if (top.bidderId !== user.id) return fail("Only the winning bidder can claim this auction.");
  const deadline = auction.claimDeadline ?? new Date(auction.endTime.getTime() + CLAIM_WINDOW_MS);
  if (top.lockStatus == null && deadline <= new Date()) return fail("The claim window for this auction has closed.");

  try {
    await finalizeAuctionSale(auction, top, auction.asset.vaulted ? "VAULT" : fulfillmentChoice, escrowLock);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Could not complete the purchase.");
  }
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
  await createOffer(user, assetId, amountThb, message);
}

/** Validates and records a buyer's offer, and notifies the owner. Shared by makeOffer and sendOfferInChat. */
async function createOffer(
  user: Awaited<ReturnType<typeof getCurrentUser>>,
  assetId: string,
  amountThb: number,
  message?: string,
) {
  if (user.isBanned) throw new Error("Your account is suspended and can't make offers.");
  const parsed = makeOfferSchema.safeParse({ amountThb, message });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Enter a valid offer.");

  const asset = await prisma.asset.findUniqueOrThrow({ where: { id: assetId } });
  if (!asset.forSale) throw new Error("This item is not currently for sale.");
  if (asset.ownerId === user.id) throw new Error("You already own this item.");

  const existing = await prisma.offer.findFirst({ where: { assetId, buyerId: user.id, status: "PENDING" } });
  if (existing) throw new Error("You already have a pending offer on this item.");

  const offer = await prisma.offer.create({
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
  return { offer, asset };
}

/** Seller accepts or rejects a pending offer. */
export async function respondToOffer(offerId: string, action: "accept" | "reject") {
  const user = await getCurrentUser();
  const offer = await prisma.offer.findUniqueOrThrow({ where: { id: offerId }, include: { asset: true } });
  if (offer.sellerId !== user.id) throw new Error("You do not own this item.");
  if (offer.status !== "PENDING") throw new Error("This offer has already been resolved.");

  // An offer the buyer's agent sent is followed up by the agent, not by hand.
  const fromAgent = await prisma.agentDecision.findUnique({ where: { offerId }, select: { id: true } });

  if (action === "accept") {
    if (!offer.asset.forSale) throw new Error("This item is no longer for sale.");
    await prisma.offer.update({ where: { id: offerId }, data: { status: "ACCEPTED", respondedAt: new Date() } });
    if (!fromAgent) await notifyUser(
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

  if (fromAgent) await handleAgentOfferResponse(offerId, action);
  await postOfferReply(
    offerId,
    user.id,
    action === "accept"
      ? `Accepted your offer of ${offer.amountThb.toLocaleString()} THB for ${offer.asset.name}. You can complete the purchase now.`
      : `Declined the offer of ${offer.amountThb.toLocaleString()} THB for ${offer.asset.name}.`,
  );

  revalidatePath("/portfolio");
}

/** When an offer was made in Messages, posts the reply to it in the same thread. */
async function postOfferReply(offerId: string, senderId: string, body: string) {
  // The offer card above it already shows the card, so the reply is text only.
  const chat = await prisma.message.findUnique({ where: { offerId }, select: { conversationId: true } });
  if (!chat) return;
  const now = new Date();
  await prisma.$transaction([
    prisma.message.create({ data: { conversationId: chat.conversationId, senderId, body, createdAt: now } }),
    prisma.conversation.update({ where: { id: chat.conversationId }, data: { lastMessageAt: now } }),
  ]);
  revalidatePath(`/messages/${chat.conversationId}`);
}

/** Buyer withdraws their own still-pending offer. */
export async function withdrawOffer(offerId: string) {
  const user = await getCurrentUser();
  const offer = await prisma.offer.findUniqueOrThrow({ where: { id: offerId } });
  if (offer.buyerId !== user.id) throw new Error("This is not your offer.");
  if (offer.status !== "PENDING") throw new Error("This offer has already been resolved.");

  await prisma.offer.update({ where: { id: offerId }, data: { status: "WITHDRAWN", respondedAt: new Date() } });
  await prisma.agentDecision.updateMany({
    where: { offerId, status: "OFFERED" },
    data: { status: "DECLINED", error: "You withdrew this offer.", resolvedAt: new Date() },
  });
  await postOfferReply(offerId, user.id, `Withdrew the offer of ${offer.amountThb.toLocaleString()} THB.`);
  revalidatePath("/portfolio");
}

/** Buyer completes a purchase at an already-accepted offer price — same real escrow-lock signing as buyListing, just at a negotiated price instead of the asking price. */
export async function completeOfferPurchase(
  offerId: string,
  fulfillmentChoice: "SHIP" | "VAULT",
  escrowLock?: { tradeId: string; txSignature: string; lamports: string; tradeAccount: string },
) {
  const user = await getCurrentUser();
  try {
    await completeOfferPurchaseAs(user, offerId, fulfillmentChoice, escrowLock);
  } catch (err) {
    await refundRejectedPurchase(escrowLock, user.walletAddress, offerId);
    throw err;
  }
}

async function completeOfferPurchaseAs(
  user: Awaited<ReturnType<typeof getCurrentUser>>,
  offerId: string,
  fulfillmentChoice: "SHIP" | "VAULT",
  escrowLock?: EscrowLockInput,
) {
  if (user.isBanned) throw new Error("Your account is suspended and can't make purchases.");

  const offer = await prisma.offer.findUniqueOrThrow({
    where: { id: offerId },
    include: { asset: { include: { owner: true } } },
  });
  if (offer.buyerId !== user.id) throw new Error("This is not your offer.");
  if (offer.status !== "ACCEPTED") throw new Error("This offer hasn't been accepted.");
  if (!offer.asset.forSale) throw new Error("This item is no longer for sale.");
  if (offer.asset.ownerId === user.id) throw new Error("You already own this item.");
  if (!escrowLock && (await realEscrowRequired(offer.asset.owner.walletAddress, user.walletAddress))) {
    throw new Error("Pay with your wallet to complete this purchase — the payment goes into escrow.");
  }
  await assertNftCanMove(offer.asset, offer.asset.owner.walletAddress);

  await completePurchase({
    asset: offer.asset,
    user,
    priceThb: offer.amountThb,
    fulfillmentChoice,
    escrowLock,
    chargeFee: true,
    soldNote: `${offer.asset.name} sold for ${offer.amountThb.toLocaleString()} THB (accepted offer).`,
    purchasedNote: offer.asset.vaulted
      ? `${offer.asset.name} is yours — ownership transferred instantly from the vault.`
      : `${offer.asset.name} — your payment of ${offer.amountThb.toLocaleString()} THB is held safely until warehouse inspection passes.`,
  });
}

/**
 * Gives the buyer-protection fee back when a sale is cancelled (inspection
 * failed, seller never shipped): the platform wallet returns the lamports to
 * whichever wallet paid them. Claimed in the DB first so it's sent once; if
 * the transfer fails it's un-claimed and logged for staff to retry.
 */
async function refundServiceFee(escrowTxId: string | null) {
  if (!escrowTxId) return;
  const tx = await prisma.escrowTransaction.findUnique({ where: { id: escrowTxId }, include: { buyer: true } });
  const to = tx?.payerWalletAddress ?? tx?.buyer.walletAddress;
  if (!tx?.serviceFeeLamports || tx.serviceFeeRefunded || !to) return;
  const claimed = await prisma.escrowTransaction.updateMany({
    where: { id: escrowTxId, serviceFeeRefunded: false },
    data: { serviceFeeRefunded: true },
  });
  if (claimed.count === 0) return;
  try {
    await sendFromPlatform(to, tx.serviceFeeLamports);
  } catch (err) {
    await prisma.escrowTransaction.update({ where: { id: escrowTxId }, data: { serviceFeeRefunded: false } });
    console.error(`Service fee refund for sale ${escrowTxId} failed.`, err);
  }
}

/** A package staff can act on right now — it has to be in the inspection queue. */
async function loadInboundPackage(inboundPackageId: string) {
  const pkg = await prisma.inboundPackage.findUniqueOrThrow({
    where: { id: inboundPackageId },
    include: { asset: true, escrowTx: { include: { buyer: true, seller: true } } },
  });
  if (pkg.status !== "PENDING_INSPECTION") throw new Error("This package isn't waiting for inspection.");
  return pkg;
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
  escrowTx: {
    onChain: boolean;
    onChainTradeId: bigint | null;
    buyer: { walletAddress: string | null };
    seller: { walletAddress: string | null };
    // Set when someone other than the buyer's own wallet locked the funds
    // (the buying agent) — the Trade PDA is derived from the payer.
    payerWalletAddress?: string | null;
  },
  assetId: string,
): Promise<{ signature: string; onChain: boolean }> {
  const buyerWallet = escrowTx.payerWalletAddress ?? escrowTx.buyer.walletAddress;
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
  if (escrowTx.onChainTradeId == null || !buyerWallet || !escrowTx.seller.walletAddress) {
    throw new Error("This trade is marked on-chain but is missing the data needed to release/refund it.");
  }

  const signature =
    kind === "release"
      ? await releaseTradeToSeller({
          buyer: buyerWallet,
          seller: escrowTx.seller.walletAddress,
          tradeId: escrowTx.onChainTradeId,
        })
      : await refundTradeToBuyer({
          buyer: buyerWallet,
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
    prisma.shipment.create({
      data: {
        reason: "SALE",
        assetId: pkg.assetId,
        recipientId: pkg.escrowTx.buyerId,
        escrowTxId: pkg.escrowTxId,
        shippingAddress: pkg.escrowTx.buyer.shippingAddress ?? "",
        phone: pkg.escrowTx.buyer.phone,
      },
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
          note: "Approved to ship to the buyer's address — tracking is added once the courier collects it.",
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
  await refundServiceFee(pkg.escrowTxId);

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

  await returnAgentBudget(pkg.escrowTxId);
  await notifyUser(
    pkg.escrowTx.buyerId,
    "SALE_CANCELLED",
    "Purchase cancelled: refunded",
    `${pkg.asset.name} didn't match its certificate at inspection, so the sale was cancelled and your ${pkg.escrowTx.amountThb.toLocaleString()} THB refunded.`,
    `/item/${pkg.assetId}`,
  );
  await notifyUser(
    pkg.escrowTx.sellerId,
    "SALE_CANCELLED",
    "Sale cancelled at inspection",
    `${pkg.asset.name} didn't match its declared certificate data, so the buyer was refunded. The card will be returned to you.`,
    `/item/${pkg.assetId}`,
  );
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
      transferApproved: await onChainTransferApproved(asset, user.walletAddress),
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
  triggerAgentsForListing(assetId);

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
      transferApproved: await onChainTransferApproved(asset, user.walletAddress),
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
  triggerAgentsForListing(assetId);

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
  itemName: z.string().trim().min(2, "Enter the card's name."),
  itemSubtitle: z.string().trim().min(2, "Add the set or a short description."),
  game: z.enum(["POKEMON", "ONE_PIECE"]),
  language: z.enum(["ENGLISH", "JAPANESE"]).default("ENGLISH"),
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
    game: formData.get("game"),
    language: formData.get("language") || undefined,
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
      // CardMart only trades Pokémon and One Piece — both trading cards.
      category: "TRADING_CARD",
      game: data.game,
      language: data.language,
      gradingCompany: data.gradingCompany as GradingCompany,
      packagePriceThb: FULL_SERVICE_PACKAGE_PRICE_THB,
      status: "AWAITING_SHIPMENT_TO_GRADER",
      mockPaymentTx: payment.txSignature,
      sellerId: user.id,
    },
  });

  await notifyAdmins(
    "NEW_SUBMISSION",
    "New grading submission",
    `${data.itemName} was sent in for ${data.gradingCompany} Full-Service grading.`,
    "/admin/grading",
  );
  revalidatePath("/portfolio");
  revalidatePath("/admin", "layout");
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
  revalidatePath("/admin", "layout");
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
  if (authorityAddress) {
    // Same rule as createListing: a real NFT or nothing, never a silent mock.
    if (!submission.seller.walletAddress) {
      return { error: "This seller has no Solana wallet on file yet. Try again after they next sign in." };
    }
    try {
      const minted = await mintDigitalTwinToken({
        ownerAddress: submission.seller.walletAddress,
        name: nftName(submission.itemName, submission.gradingCompany, parsed.data.grade),
      });
      mintTxSignature = minted.txSignature;
      mintAddress = minted.mintAddress;
    } catch (err) {
      console.error("Digital twin mint failed", err);
      return { error: "Couldn't mint the NFT on Solana just now. Try again in a moment." };
    }
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
      game: submission.game,
      language: submission.language,
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
  revalidatePath("/admin", "layout");
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
function assertRedeemable(
  asset: { ownerId: string | null; vaulted: boolean; redeemedAt: Date | null; marketStatus: string },
  userId: string,
) {
  if (asset.ownerId !== userId) throw new Error("You do not own this item.");
  if (!asset.vaulted) throw new Error("This item is not in the vault.");
  if (asset.redeemedAt) throw new Error("This item was already redeemed.");
  if (asset.marketStatus === "IN_AUCTION") throw new Error("End the auction before redeeming this item.");
  if (asset.marketStatus === "IN_ESCROW") throw new Error("This item is locked in an active sale.");
}

const redeemShippingSchema = z.object({
  shippingAddress: z.string().trim().min(10, "Enter a full address — we ship real items here."),
  phone: z.string().trim().min(6, "Enter a phone number the courier can reach you on."),
});

/**
 * Step 1 of redeeming, run BEFORE the owner signs the burn: checks the item
 * can be redeemed and saves where to ship it. The burn can't be undone, so
 * anything that would make vaultRedeem refuse has to fail here, while the
 * token still exists.
 */
export async function prepareVaultRedeem(assetId: string, shipping: { shippingAddress: string; phone: string }) {
  const user = await getCurrentUser();
  const asset = await prisma.asset.findUniqueOrThrow({ where: { id: assetId } });
  assertRedeemable(asset, user.id);
  const parsed = redeemShippingSchema.safeParse(shipping);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Enter a shipping address and phone number.");
  await prisma.user.update({
    where: { id: user.id },
    data: { shippingAddress: parsed.data.shippingAddress, phone: parsed.data.phone },
  });
}

export async function vaultRedeem(assetId: string, burnTxSignature?: string) {
  const user = await getCurrentUser();
  const asset = await prisma.asset.findUniqueOrThrow({ where: { id: assetId } });
  assertRedeemable(asset, user.id);
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
  await prisma.shipment.create({
    data: {
      reason: "REDEEM",
      assetId,
      recipientId: user.id,
      shippingAddress: user.shippingAddress,
      phone: user.phone,
    },
  });
  await notifyAdmins(
    "NEW_SUBMISSION",
    "Vault redemption",
    `${asset.name} was redeemed and needs to be packed and shipped to its owner.`,
    "/admin/shipments",
  );

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

/**
 * eBay's exact-match asking price for this card in another grade, fetched
 * when the item page's grade picker switches to a grade it didn't preload.
 */
export async function getEbayQuoteForGrade(
  assetId: string,
  tier: { gradingCompany: string; grade: number | null; isBlackLabel: boolean },
): Promise<EbayPriceQuote | null> {
  await getCurrentUser();
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { name: true, subtitle: true, cardNumber: true },
  });
  if (!asset) return null;
  return lookupEbayPrice({ ...asset, ...tier }).catch(() => null);
}

/**
 * Range-switcher re-fetch for the current user's own total
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
  revalidatePath("/admin", "layout");
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
  revalidatePath("/admin", "layout");
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
  revalidatePath("/admin", "layout");
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

const MAX_CHAT_PHOTOS = 4;

const sendMessageSchema = z.object({
  body: z.string().trim().max(2000, "Message is too long (2000 characters max)."),
  imageUrls: z.array(z.string()).max(MAX_CHAT_PHOTOS, `Up to ${MAX_CHAT_PHOTOS} photos per message.`),
});

/** The thread, only if the user is in it. */
async function myConversation(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, OR: [{ userAId: userId }, { userBId: userId }] },
  });
  if (!conversation) throw new Error("Conversation not found.");
  return conversation;
}

/**
 * Saves one chat message (text, photos, an attached card and/or an offer),
 * bumps the thread, and emails the other person on the first unread message
 * of a burst — one email per burst of chat, not one per line.
 */
async function postChatMessage(
  user: Awaited<ReturnType<typeof getCurrentUser>>,
  conversation: { id: string; userAId: string; userBId: string },
  data: { body: string; imageUrls?: string[]; assetId?: string | null; offerId?: string | null },
) {
  const now = new Date();
  const alreadyUnread = await prisma.message.count({
    where: { conversationId: conversation.id, senderId: user.id, readAt: null },
  });
  await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: user.id,
        body: data.body,
        imageUrls: data.imageUrls ?? [],
        assetId: data.assetId ?? null,
        offerId: data.offerId ?? null,
        createdAt: now,
      },
    }),
    prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: now } }),
  ]);
  if (alreadyUnread === 0) {
    const recipientId = conversation.userAId === user.id ? conversation.userBId : conversation.userAId;
    const text = data.body || (data.imageUrls?.length ? "Sent a photo." : "");
    const preview = text.length > 140 ? `${text.slice(0, 140)}…` : text;
    emailUser(recipientId, `New message from ${user.name ?? user.handle ?? "a collector"}`, preview, `/messages/${conversation.id}`);
  }
  revalidatePath("/messages");
  revalidatePath(`/messages/${conversation.id}`);
}

export async function sendMessage(
  conversationId: string,
  body: string,
  attachments: { imageUrls?: string[]; assetId?: string | null } = {},
) {
  const user = await getCurrentUser();
  if (user.isBanned) throw new Error("Your account is suspended and can't send messages.");
  const parsed = sendMessageSchema.safeParse({ body, imageUrls: attachments.imageUrls ?? [] });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Enter a message.");
  const { imageUrls } = parsed.data;
  if (!parsed.data.body && imageUrls.length === 0 && !attachments.assetId) throw new Error("Message can't be empty.");
  // Photos have to be fresh uploads to our own storage, never outside links.
  if (!imageUrls.every(isOwnUploadUrl)) throw new Error("Photos must be uploaded here, not linked from elsewhere.");

  const conversation = await myConversation(conversationId, user.id);
  if (attachments.assetId) {
    // Only a card one of the two people in this chat owns can be attached.
    const asset = await prisma.asset.findUnique({ where: { id: attachments.assetId }, select: { ownerId: true } });
    if (!asset || (asset.ownerId !== conversation.userAId && asset.ownerId !== conversation.userBId)) {
      throw new Error("You can only attach a card one of you owns.");
    }
  }
  await postChatMessage(user, conversation, { body: parsed.data.body, imageUrls, assetId: attachments.assetId });
}

/**
 * Makes an offer on the other person's listing from inside the chat: the
 * same offer as on the item page (they accept or decline it, and the buyer
 * pays through escrow), shown as an offer card in the thread.
 */
export async function sendOfferInChat(conversationId: string, assetId: string, amountThb: number, note?: string) {
  const user = await getCurrentUser();
  const conversation = await myConversation(conversationId, user.id);
  const otherId = conversation.userAId === user.id ? conversation.userBId : conversation.userAId;
  const owner = await prisma.asset.findUnique({ where: { id: assetId }, select: { ownerId: true } });
  if (owner?.ownerId !== otherId) throw new Error("You can only make an offer on a card the other person owns.");

  const { offer, asset } = await createOffer(user, assetId, amountThb, note?.trim() || undefined);
  await postChatMessage(user, conversation, {
    body: `Offered ${offer.amountThb.toLocaleString()} THB for ${asset.name}.${note?.trim() ? ` ${note.trim()}` : ""}`,
    assetId,
    offerId: offer.id,
  });
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
/**
 * Whether a purchase between these two wallets has to be paid through the
 * real escrow program: it's deployed and both sides have a wallet. Then a
 * client that skips the lock is refused instead of falling back to the
 * simulated flow (which would hand over the card unpaid).
 */
async function realEscrowRequired(sellerWallet: string | null, buyerWallet: string | null): Promise<boolean> {
  return Boolean(sellerWallet && buyerWallet && (await getEscrowAuthorityAddress()));
}

async function refundUnrecordedLock(lock: EscrowLockInput | undefined, payerWallet: string | null, assetId: string) {
  if (!lock || !payerWallet) return;
  // Only a lock nothing on CardMart relies on. Without this, a buyer could
  // send the trade ID of one of their own live purchases, get rejected on
  // purpose, and pull that purchase's escrow back while the sale goes on.
  let pda: string;
  try {
    pda = await deriveTradePda(address(payerWallet), BigInt(lock.tradeId));
  } catch {
    return;
  }
  const [sale, bid, trade] = await Promise.all([
    prisma.escrowTransaction.count({ where: { tradeAccount: pda } }),
    prisma.bid.count({ where: { tradeAccount: pda } }),
    prisma.tradeOffer.count({ where: { cashTradeAccount: pda } }),
  ]);
  if (sale + bid + trade > 0) return false;
  return releaseOrRefundEscrow(
    "refund",
    {
      onChain: true,
      onChainTradeId: BigInt(lock.tradeId),
      buyer: { walletAddress: payerWallet },
      seller: { walletAddress: null },
    },
    assetId,
  ).then(
    () => true,
    // Best-effort: the original error is what the user needs to see.
    () => false,
  );
}

/**
 * A purchase was refused after the buyer's browser already locked payment
 * (sold a moment earlier, NFT not approved, lock didn't verify…): give the
 * escrow back, and the buyer-protection fee paid in the same transaction.
 * The fee goes back only when this call actually refunded the escrow, so a
 * retry can't pay it twice.
 */
async function refundRejectedPurchase(lock: EscrowLockInput | undefined, payerWallet: string | null, assetId: string) {
  if (!lock || !payerWallet) return;
  if (!(await refundUnrecordedLock(lock, payerWallet, assetId))) return;
  const platform = await getEscrowAuthorityAddress();
  if (!platform) return;
  const paid = await verifyServiceFee(lock, { buyer: payerWallet, platform, minLamports: BigInt(1) }).catch(() => BigInt(0));
  if (paid > BigInt(0)) {
    await sendFromPlatform(payerWallet, paid).catch((err) =>
      console.error(`Fee refund for rejected lock ${lock.tradeAccount} failed.`, err),
    );
  }
}

/** Whether the platform is approved on-chain to move this card's NFT out of its owner's wallet. */
async function onChainTransferApproved(
  asset: { mintAddress: string | null },
  ownerWallet: string | null,
  opts: { retry?: boolean } = {},
): Promise<boolean> {
  if (!asset.mintAddress || !ownerWallet) return false;
  // A wallet returns as soon as it sends the approval, so a fresh one can
  // take a few seconds to show up; check a few times before saying no.
  const attempts = opts.retry === false ? 1 : 5;
  for (let i = 0; i < attempts; i++) {
    if ((await isTransferDelegated({ mintAddress: asset.mintAddress, ownerAddress: ownerWallet })) === true) return true;
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

/**
 * A card with a real NFT can only be sold once its owner has approved the
 * platform to move it; otherwise the sale would complete while the NFT
 * stayed in the seller's wallet. Legacy cards whose NFT never reached this
 * owner (an earlier simulated transfer) have nothing to move and pass.
 */
async function assertNftCanMove(asset: { mintAddress: string | null }, sellerWallet: string | null) {
  if (!asset.mintAddress || !sellerWallet || !(await getEscrowAuthorityAddress())) return;
  const held = await isDigitalTwinHeldBy({ mintAddress: asset.mintAddress, ownerAddress: sellerWallet });
  if (held === false) return;
  if (!(await onChainTransferApproved(asset, sellerWallet, { retry: false }))) {
    throw new Error("The seller hasn't approved this card's NFT transfer yet, so it can't be bought right now.");
  }
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

  if (cashThb > 0 && opts.cashLock) {
    if (!user.walletAddress) throw new Error("Your account has no wallet to pay from.");
    const recipient = await prisma.user.findUnique({ where: { id: requested.ownerId }, select: { walletAddress: true } });
    await verifyEscrowLock(opts.cashLock, {
      buyer: user.walletAddress,
      seller: recipient?.walletAddress,
      minLamports: thbToLamports(cashThb),
    });
  }

  if (offered.mintAddress && opts.approveTxSignature && (await onChainTransferApproved(offered, user.walletAddress))) {
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
  // The recipient's own cash top-up (cashThb < 0) has to be really locked.
  if (trade.cashThb < 0 && opts.cashLock) {
    if (!user.walletAddress) throw new Error("Your account has no wallet to pay from.");
    await verifyEscrowLock(opts.cashLock, {
      buyer: user.walletAddress,
      seller: proposer.walletAddress,
      minLamports: thbToLamports(-trade.cashThb),
    });
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
// by hand from the back office, with two live camera photos (the ID, and a
// selfie holding it) kept in a private Blob store — see lib/kyc-storage.ts.
// ---------------------------------------------------------------------------

/**
 * Thai national ID: 13 digits whose last digit is a mod-11 checksum of the
 * first 12 (weights 13 down to 2) — catches typos and made-up numbers.
 */
function isValidThaiNationalId(raw: string): boolean {
  const digits = raw.replace(/[\s-]/g, "");
  if (!/^\d{13}$/.test(digits)) return false;
  const sum = [...digits.slice(0, 12)].reduce((acc, d, i) => acc + Number(d) * (13 - i), 0);
  return (11 - (sum % 11)) % 10 === Number(digits[12]);
}

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
}).superRefine((data, ctx) => {
  if (data.idType === "NATIONAL_ID" && !isValidThaiNationalId(data.idNumber)) {
    ctx.addIssue({ code: "custom", message: "That isn't a valid 13-digit Thai national ID number — check it and try again." });
  }
  if (data.idType === "PASSPORT" && !/^[A-Za-z0-9]{6,9}$/.test(data.idNumber.replace(/[\s-]/g, ""))) {
    ctx.addIssue({ code: "custom", message: "Passport numbers are 6–9 letters and digits." });
  }
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

  // Two live camera photos: the ID itself, and a selfie holding it.
  if (!isKycPhotoStorageConfigured()) {
    return {
      error: "ID photo storage isn't set up on this deployment yet, so verification can't be submitted. Please try again later.",
    };
  }
  const idPhoto = formData.get("idPhoto");
  const selfie = formData.get("selfie");
  const photoError = checkKycPhoto(idPhoto, "ID card") ?? checkKycPhoto(selfie, "selfie");
  if (photoError) return { error: photoError };

  let idPhotoUrl: string;
  let selfieUrl: string;
  try {
    [idPhotoUrl, selfieUrl] = await Promise.all([
      saveKycPhoto(user.id, "id", idPhoto as File),
      saveKycPhoto(user.id, "selfie", selfie as File),
    ]);
  } catch (err) {
    console.error("[kyc] photo upload failed:", err);
    return { error: "Couldn't save your photos. Check your connection and try again." };
  }
  // A resubmission replaces the previous photos — old ID images aren't kept.
  await deleteKycPhotos([user.kycIdPhotoUrl, user.kycSelfieUrl]);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      kycStatus: "PENDING",
      kycIdPhotoUrl: idPhotoUrl,
      kycSelfieUrl: selfieUrl,
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
    "/admin/identity",
  );

  revalidatePath("/portfolio");
  revalidatePath("/admin", "layout");
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

  revalidatePath("/admin", "layout");
  revalidatePath(`/store/${userId}`);
}

/** Admin-only live check of the PSA, eBay and TCG APIs (see lib/integrations.ts). */
export async function runIntegrationCheck() {
  await requireAdmin();
  return checkAllIntegrations();
}

/**
 * Staff-only: grants or revokes back-office access. An admin can't demote
 * themselves, so the back office can never be left with nobody able to get in
 * by accident.
 */
export async function toggleUserAdmin(userId: string): Promise<{ isAdmin: boolean }> {
  const admin = await requireAdmin();
  if (userId === admin.id) throw new Error("You can't remove your own staff access.");

  const target = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (target.isBanned && !target.isAdmin) throw new Error("Restore this account before giving it staff access.");
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isAdmin: !target.isAdmin },
  });
  revalidatePath("/admin", "layout");
  return { isAdmin: updated.isAdmin };
}

// ---------------------------------------------------------------------------
// Shipments — a card leaving the warehouse for a home address (see Shipment
// in prisma/schema.prisma). Created by warehouseApproveShip and vaultRedeem;
// staff move it along from the back office.
// ---------------------------------------------------------------------------

const dispatchSchema = z.object({
  carrier: z.string().trim().min(2, "Enter the courier.").max(60),
  trackingNumber: z.string().trim().min(4, "Enter the tracking number.").max(60),
});

export async function dispatchShipment(shipmentId: string, carrier: string, trackingNumber: string) {
  await requireAdmin();
  const parsed = dispatchSchema.safeParse({ carrier, trackingNumber });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid tracking details.");

  const shipment = await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId }, include: { asset: true } });
  if (shipment.status === "DELIVERED") throw new Error("This shipment was already delivered.");

  await prisma.shipment.update({
    where: { id: shipmentId },
    data: { ...parsed.data, status: "SHIPPED", shippedAt: shipment.shippedAt ?? new Date() },
  });
  // Only notify on the first dispatch, not on a later tracking-number correction.
  if (shipment.status === "AWAITING_DISPATCH") {
    await notifyUser(
      shipment.recipientId,
      "SHIPMENT_DISPATCHED",
      "Your card is on its way",
      `${shipment.asset.name} shipped with ${parsed.data.carrier}. Tracking number: ${parsed.data.trackingNumber}.`,
      `/item/${shipment.assetId}`,
    );
  }
  revalidatePath("/admin", "layout");
  revalidatePath(`/item/${shipment.assetId}`);
}

export async function markShipmentDelivered(shipmentId: string) {
  await requireAdmin();
  const shipment = await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId }, include: { asset: true } });
  if (shipment.status !== "SHIPPED") throw new Error("Add tracking before marking this delivered.");

  await prisma.shipment.update({
    where: { id: shipmentId },
    data: { status: "DELIVERED", deliveredAt: new Date() },
  });
  await notifyUser(
    shipment.recipientId,
    "SHIPMENT_DELIVERED",
    "Delivered",
    `${shipment.asset.name} was delivered. If anything is wrong with it, report a problem from the item page.`,
    `/item/${shipment.assetId}`,
  );
  revalidatePath("/admin", "layout");
  revalidatePath(`/item/${shipment.assetId}`);
}

// ---------------------------------------------------------------------------
// Disputes — a buyer reporting a problem with a completed purchase. The
// escrow is already released by then, so resolving one records the outcome;
// any refund is paid out by staff outside the app.
// ---------------------------------------------------------------------------

const disputeSchema = z.object({
  reason: z.enum(["NOT_RECEIVED", "NOT_AS_DESCRIBED", "DAMAGED", "OTHER"]),
  description: z.string().trim().min(20, "Describe the problem in at least 20 characters.").max(2000),
});

export async function openDispute(
  escrowTxId: string,
  reason: string,
  description: string,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  const parsed = disputeSchema.safeParse({ reason, description });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid report." };

  const tx = await prisma.escrowTransaction.findUnique({
    where: { id: escrowTxId },
    include: { asset: true, dispute: true },
  });
  if (!tx || tx.buyerId !== user.id) return { error: "You can only report a problem with your own purchase." };
  if (tx.status !== "RELEASED" || !tx.releasedAt) return { error: "This purchase isn't complete yet." };
  if (tx.dispute) return { error: "You already reported a problem with this purchase." };
  if (!isWithinDisputeWindow(tx.releasedAt)) {
    return { error: `Problems can be reported up to ${DISPUTE_WINDOW_DAYS} days after a purchase.` };
  }

  await prisma.dispute.create({
    data: { ...parsed.data, escrowTxId, openedById: user.id },
  });
  await notifyAdmins(
    "DISPUTE_OPENED",
    "Problem reported",
    `${user.name ?? user.handle ?? "A buyer"} reported a problem with ${tx.asset.name} (${tx.amountThb.toLocaleString()} THB).`,
    "/admin/disputes",
  );
  revalidatePath("/admin", "layout");
  revalidatePath(`/item/${tx.assetId}`);
  return {};
}

export async function resolveDispute(disputeId: string, outcome: "refunded" | "no_action", note: string) {
  await requireAdmin();
  const trimmed = note.trim().slice(0, 1000);
  if (trimmed.length < 5) throw new Error("Add a short note for the buyer.");

  const dispute = await prisma.dispute.findUniqueOrThrow({
    where: { id: disputeId },
    include: { escrowTx: { include: { asset: true } } },
  });
  if (dispute.status !== "OPEN") throw new Error("This dispute is already resolved.");

  await prisma.dispute.update({
    where: { id: disputeId },
    data: {
      status: outcome === "refunded" ? "RESOLVED_REFUNDED" : "RESOLVED_NO_ACTION",
      resolutionNote: trimmed,
      resolvedAt: new Date(),
    },
  });
  await notifyUser(
    dispute.openedById,
    "DISPUTE_RESOLVED",
    outcome === "refunded" ? "Your report was resolved: refund issued" : "Your report was reviewed",
    trimmed,
    `/item/${dispute.escrowTx.assetId}`,
  );
  revalidatePath("/admin", "layout");
  revalidatePath(`/item/${dispute.escrowTx.assetId}`);
}

// ---------------------------------------------------------------------------
// Seller → warehouse leg. After a non-vaulted sale the seller has
// SELLER_SHIP_DAYS to send the card in and enter its tracking number; only
// then does the package join the inspection queue. Missing the deadline
// cancels the sale and refunds the buyer.
// ---------------------------------------------------------------------------

const sellerShipmentSchema = z.object({
  carrier: z.string().trim().min(2, "Enter the courier.").max(60),
  trackingNumber: z.string().trim().min(4, "Enter the tracking number.").max(60),
});

export async function markShippedToWarehouse(
  inboundPackageId: string,
  carrier: string,
  trackingNumber: string,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  const parsed = sellerShipmentSchema.safeParse({ carrier, trackingNumber });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid tracking details." };

  const pkg = await prisma.inboundPackage.findUnique({
    where: { id: inboundPackageId },
    include: { asset: true, escrowTx: true },
  });
  if (!pkg || pkg.escrowTx.sellerId !== user.id) return { error: "This isn't one of your sales." };

  // A tracking-number correction after shipping: just update it.
  if (pkg.status === "PENDING_INSPECTION") {
    await prisma.inboundPackage.update({
      where: { id: pkg.id },
      data: { sellerCarrier: parsed.data.carrier, sellerTrackingNumber: parsed.data.trackingNumber },
    });
    revalidatePath("/portfolio");
    revalidatePath("/admin", "layout");
    return {};
  }
  if (pkg.status !== "AWAITING_SELLER_SHIPMENT") return { error: "This sale is no longer waiting for you to ship." };
  if (pkg.shipByDeadline && pkg.shipByDeadline < new Date()) {
    return { error: "The shipping deadline has passed, so this sale is being cancelled." };
  }

  // Conditional on the status so this can't race the deadline expiry.
  const now = new Date();
  const claimed = await prisma.inboundPackage.updateMany({
    where: { id: pkg.id, status: "AWAITING_SELLER_SHIPMENT" },
    data: {
      status: "PENDING_INSPECTION",
      sellerCarrier: parsed.data.carrier,
      sellerTrackingNumber: parsed.data.trackingNumber,
      sellerShippedAt: now,
      arrivedAt: now,
    },
  });
  if (claimed.count === 0) return { error: "This sale is no longer waiting for you to ship." };

  const shipTx = await mockEscrowInstruction("lock", pkg.assetId);
  await prisma.asset.update({ where: { id: pkg.assetId }, data: { pipelineStage: "IN_TRANSIT_TO_WAREHOUSE" } });
  await prisma.provenanceEvent.create({
    data: {
      assetId: pkg.assetId,
      type: "SHIPPED_TO_WAREHOUSE",
      note: `Seller shipped the card to the CardMart warehouse with ${parsed.data.carrier}.`,
      mockTxSignature: shipTx.txSignature,
      actorId: user.id,
    },
  });
  await notifyUser(
    pkg.escrowTx.buyerId,
    "SELLER_SHIPPED",
    "The seller shipped your card",
    `${pkg.asset.name} is on its way to our warehouse for inspection (${parsed.data.carrier} ${parsed.data.trackingNumber}).`,
    `/item/${pkg.assetId}`,
  );
  await notifyAdmins(
    "NEW_SUBMISSION",
    "Inbound package on its way",
    `${pkg.asset.name} (${packageReference(pkg.id)}) sold for ${pkg.escrowTx.amountThb.toLocaleString()} THB — ${parsed.data.carrier} ${parsed.data.trackingNumber}.`,
    "/admin/inbound",
  );
  revalidateMarketplace(pkg.assetId);
  return {};
}

/**
 * Cancels every sale whose seller missed the shipping deadline: refunds the
 * buyer, takes the listing down (the seller can relist once they're ready to
 * ship) and tells both sides. Safe to call from anywhere, any number of
 * times — it only ever touches packages that are already overdue, and each
 * one is claimed with a conditional update so two callers can't refund the
 * same sale. Runs daily from /api/cron/expire-seller-shipments and lazily
 * when Portfolio, an item page or the inbound queue is viewed; pass
 * { revalidate: false } from inside a render, where revalidatePath isn't allowed.
 */
export async function expireOverdueSellerShipments(opts: { revalidate?: boolean } = {}): Promise<number> {
  const overdue = await prisma.inboundPackage.findMany({
    where: { status: "AWAITING_SELLER_SHIPMENT", shipByDeadline: { lt: new Date() } },
    include: { asset: true, escrowTx: { include: { buyer: true, seller: true } } },
    take: 25,
  });

  let expired = 0;
  for (const pkg of overdue) {
    const claimed = await prisma.inboundPackage.updateMany({
      where: { id: pkg.id, status: "AWAITING_SELLER_SHIPMENT" },
      data: { status: "EXPIRED", resolvedAt: new Date() },
    });
    if (claimed.count === 0) continue;

    let refund: { signature: string; onChain: boolean };
    try {
      refund = await releaseOrRefundEscrow("refund", pkg.escrowTx, pkg.assetId);
      await refundServiceFee(pkg.escrowTxId);
    } catch (err) {
      // Real funds are still locked on-chain — put the package back so the
      // next run retries, rather than recording a refund that didn't happen.
      await prisma.inboundPackage.update({
        where: { id: pkg.id },
        data: { status: "AWAITING_SELLER_SHIPMENT", resolvedAt: null },
      });
      console.error(`Refund for overdue sale ${pkg.id} failed; will retry.`, err);
      continue;
    }

    await prisma.$transaction([
      prisma.escrowTransaction.update({ where: { id: pkg.escrowTxId }, data: { status: "REFUNDED" } }),
      prisma.asset.update({
        where: { id: pkg.assetId },
        data: { forSale: false, marketStatus: "DELISTED", pipelineStage: "NONE" },
      }),
      prisma.provenanceEvent.create({
        data: {
          assetId: pkg.assetId,
          type: "ESCROW_REFUNDED",
          note: `Seller didn't ship within ${SELLER_SHIP_DAYS} days. Sale cancelled and the buyer refunded in full.`,
          mockTxSignature: refund.signature,
          onChain: refund.onChain,
        },
      }),
    ]);
    await returnAgentBudget(pkg.escrowTxId);
    await notifyUser(
      pkg.escrowTx.buyerId,
      "SALE_CANCELLED",
      "Purchase cancelled: refunded",
      `The seller didn't ship ${pkg.asset.name} in time, so the sale was cancelled and your ${pkg.escrowTx.amountThb.toLocaleString()} THB refunded.`,
      `/item/${pkg.assetId}`,
    );
    await notifyUser(
      pkg.escrowTx.sellerId,
      "SALE_CANCELLED",
      "Sale cancelled: not shipped in time",
      `${pkg.asset.name} wasn't shipped within ${SELLER_SHIP_DAYS} days, so the buyer was refunded and the listing taken down. Relist it from Portfolio when you're ready to ship.`,
      "/portfolio",
    );
    await notifyAdmins(
      "NEW_SUBMISSION",
      "Sale cancelled: seller didn't ship",
      `${pkg.asset.name} (${packageReference(pkg.id)}) — ${pkg.escrowTx.seller.name ?? pkg.escrowTx.seller.handle ?? "seller"} missed the shipping deadline. Buyer refunded.`,
      "/admin/history",
    );
    if (opts.revalidate !== false) revalidateMarketplace(pkg.assetId);
    expired++;
  }
  return expired;
}

// ---------------------------------------------------------------------------
// Buying agent — executing purchases. Planning and judging live in
// lib/agent/; this part lives here because it reuses completePurchase and the
// escrow helpers above. Every limit is re-checked right before paying, and
// the budget and the listing are each claimed with a conditional update, so
// two runs (or the agent and a human buyer) can't both win.
// ---------------------------------------------------------------------------

async function notifyAgentOwner(userId: string, type: NotificationType, title: string, body: string, href: string) {
  await notifyUser(userId, type, title, body, href);
}

async function failAgentDecision(decisionId: string, userId: string, assetName: string, reason: string) {
  await prisma.agentDecision.update({
    where: { id: decisionId },
    data: { status: "FAILED", error: reason, resolvedAt: new Date() },
  });
  await notifyUser(userId, "AGENT_FAILED", "Your agent couldn't buy a card", `${assetName}: ${reason}`, "/agent");
}

async function executeAgentDecision(decisionId: string): Promise<void> {
  const decision = await prisma.agentDecision.findUnique({
    where: { id: decisionId },
    include: {
      mandate: { include: { user: { include: { agentWallet: true } } } },
      asset: { include: { owner: true } },
      offer: true,
    },
  });
  if (!decision || decision.status !== "PROPOSED") return;
  const { mandate, asset } = decision;
  const buyer = mandate.user;
  // An accepted offer is paid at the offer; otherwise at the asking price.
  const asking = decision.priceThb;
  const price = decision.offerThb ?? asking;

  if (buyer.isBanned) return failAgentDecision(decisionId, buyer.id, asset.name, "Your account is suspended.");
  if (mandate.status !== "ACTIVE") return failAgentDecision(decisionId, buyer.id, asset.name, "This agent task is paused or finished.");
  if (price > mandate.maxPriceThb) return failAgentDecision(decisionId, buyer.id, asset.name, "Over your maximum price.");
  if (decision.offerId && decision.offer?.status !== "ACCEPTED") {
    return failAgentDecision(decisionId, buyer.id, asset.name, "The seller hasn't accepted the offer.");
  }
  if (!asset.forSale || asset.priceThb !== asking || asset.redeemedAt || asset.ownerId === buyer.id) {
    return failAgentDecision(decisionId, buyer.id, asset.name, "It's no longer for sale at that price.");
  }
  try {
    await assertNftCanMove(asset, asset.owner.walletAddress);
  } catch (err) {
    return failAgentDecision(decisionId, buyer.id, asset.name, err instanceof Error ? err.message : "The card can't be bought yet.");
  }

  // Claim budget and a card slot.
  const budget = await prisma.agentMandate.updateMany({
    where: {
      id: mandate.id,
      status: "ACTIVE",
      spentThb: { lte: mandate.budgetThb - price },
      boughtCount: { lt: mandate.maxCards },
    },
    data: { spentThb: { increment: price }, boughtCount: { increment: 1 } },
  });
  if (budget.count === 0) return failAgentDecision(decisionId, buyer.id, asset.name, "Not enough budget left on this task.");

  const releaseBudget = () =>
    prisma.agentMandate.update({
      where: { id: mandate.id },
      data: { spentThb: { decrement: price }, boughtCount: { decrement: 1 } },
    });

  // Claim the listing itself.
  const listing = await prisma.asset.updateMany({
    where: { id: asset.id, forSale: true, priceThb: asking, marketStatus: { in: ["READY_TO_SHIP", "IN_VAULT"] } },
    data: { forSale: false },
  });
  if (listing.count === 0) {
    await releaseBudget();
    return failAgentDecision(decisionId, buyer.id, asset.name, "Someone else bought it first.");
  }

  try {
    // Real on-chain payment from the agent wallet when everything needed is
    // there; otherwise the same simulated escrow a browser purchase falls
    // back to.
    const wallet = buyer.agentWallet;
    const onChain = Boolean(wallet && asset.owner.walletAddress && (await isAgentChainEnabled()));
    const escrowLock =
      onChain && wallet && asset.owner.walletAddress
        ? await agentLockPayment({
            wallet,
            sellerWalletAddress: asset.owner.walletAddress,
            lamports: thbToLamports(price),
            feeLamports: thbToLamports(buyerFeeThb(price)),
          })
        : undefined;

    const { escrowTxId } = await completePurchase({
      asset,
      user: buyer,
      priceThb: price,
      fulfillmentChoice: mandate.fulfillment,
      escrowLock,
      payerWalletAddress: escrowLock && wallet ? wallet.address : undefined,
      chargeFee: true,
      soldNote: `${asset.name} sold instantly from your vault for ${price.toLocaleString()} THB.`,
      purchasedNote: asset.vaulted
        ? `Your buying agent bought ${asset.name} for ${price.toLocaleString()} THB — it's already in your vault.`
        : `Your buying agent bought ${asset.name} for ${price.toLocaleString()} THB. The payment is held safely until warehouse inspection passes.`,
    });

    await prisma.agentDecision.update({
      where: { id: decisionId },
      data: { status: "EXECUTED", escrowTxId, resolvedAt: new Date() },
    });
    const updated = await prisma.agentMandate.findUniqueOrThrow({ where: { id: mandate.id } });
    const finished = updated.boughtCount >= updated.maxCards;
    if (finished) {
      await prisma.agentMandate.update({ where: { id: mandate.id }, data: { status: "DONE" } });
      await withdrawAgentOffers(mandate.id);
    }
    await notifyUser(
      buyer.id,
      "AGENT_PURCHASE",
      "Your agent bought a card",
      `${asset.name} for ${price.toLocaleString()} THB. ${decision.reasoning}`,
      `/item/${asset.id}`,
    );
    if (finished) {
      // The card is bought by now: a failed summary must not reach the
      // catch below, which would undo a purchase that went through.
      await taskReportText(mandate.id)
        .then((body) => notifyUser(buyer.id, "AGENT_REPORT", "Your agent task is done", body, "/agent"))
        .catch((err) => console.error(`Agent task report for mandate ${mandate.id} failed`, err));
    }
  } catch (err) {
    // Nothing was bought: put the listing and the budget back.
    await prisma.asset.updateMany({
      where: { id: asset.id, ownerId: asset.ownerId, marketStatus: asset.marketStatus },
      data: { forSale: true },
    });
    await releaseBudget();
    await failAgentDecision(decisionId, buyer.id, asset.name, err instanceof Error ? err.message : "The purchase failed.");
  }
}

/** Sends the seller the offer the engine decided on (a match priced above the task's max). */
async function sendAgentOffer(decisionId: string): Promise<void> {
  const decision = await prisma.agentDecision.findUnique({
    where: { id: decisionId },
    include: { mandate: true, asset: true },
  });
  if (!decision || decision.status !== "OFFERED" || decision.offerThb == null) return;
  const { asset, mandate } = decision;
  const pending = await prisma.offer.findFirst({ where: { assetId: asset.id, buyerId: mandate.userId, status: "PENDING" } });
  if (!asset.forSale || asset.ownerId === mandate.userId || pending) {
    await prisma.agentDecision.update({
      where: { id: decisionId },
      data: { status: "SKIPPED", error: "Couldn't send an offer on this listing.", resolvedAt: new Date() },
    });
    return;
  }
  const offer = await prisma.offer.create({
    data: {
      assetId: asset.id,
      buyerId: mandate.userId,
      sellerId: asset.ownerId,
      amountThb: decision.offerThb,
      message: "Sent by the buyer's buying agent.",
    },
  });
  await prisma.agentDecision.update({ where: { id: decisionId }, data: { offerId: offer.id } });
  await notifyUser(
    asset.ownerId,
    "OFFER_RECEIVED",
    "New offer received",
    `A buyer offered ${decision.offerThb.toLocaleString()} THB for ${asset.name}.`,
    "/portfolio",
  );
}

/** The seller answered an offer the buying agent sent: buy (or ask the owner), or record the no. */
async function handleAgentOfferResponse(offerId: string, action: "accept" | "reject") {
  const decision = await prisma.agentDecision.findUnique({
    where: { offerId },
    include: { mandate: true, asset: true },
  });
  if (!decision || decision.status !== "OFFERED" || decision.offerThb == null) return;
  const amount = `${decision.offerThb.toLocaleString()} THB`;

  if (action === "reject") {
    await prisma.agentDecision.update({
      where: { id: decision.id },
      data: { status: "FAILED", error: `The seller declined the ${amount} offer.`, resolvedAt: new Date() },
    });
    return;
  }

  await prisma.agentDecision.update({ where: { id: decision.id }, data: { status: "PROPOSED" } });
  if (decision.mandate.autoBuy) {
    after(() => executeAgentDecision(decision.id).catch((err) => console.error("Agent offer purchase failed", err)));
  } else {
    await notifyUser(
      decision.mandate.userId,
      "AGENT_PROPOSAL",
      "The seller accepted your agent's offer",
      `${decision.asset.name} for ${amount}. Approve it to buy.`,
      "/agent",
    );
  }
}

/** When an agent-bought sale is refunded (inspection rejected, seller didn't ship), give the task its budget back. */
async function returnAgentBudget(escrowTxId: string) {
  const decision = await prisma.agentDecision.findUnique({ where: { escrowTxId } });
  if (!decision || decision.status !== "EXECUTED") return;
  await prisma.agentDecision.update({
    where: { id: decision.id },
    data: { status: "FAILED", error: "The sale was cancelled and refunded to your agent wallet." },
  });
  await prisma.agentMandate.update({
    where: { id: decision.mandateId },
    data: { spentThb: { decrement: decision.offerThb ?? decision.priceThb }, boughtCount: { decrement: 1 }, status: "ACTIVE" },
  });
}

/** Lets any active buying agent look at a card that just went on sale (runs after the response). */
function triggerAgentsForListing(assetId: string) {
  after(() =>
    runMandatesForListing(assetId, { execute: executeAgentDecision, notify: notifyAgentOwner, offer: sendAgentOffer }).catch((err) =>
      console.error("Agent run failed", err),
    ),
  );
}

async function loadOwnMandate(mandateId: string) {
  const user = await getCurrentUser();
  const mandate = await prisma.agentMandate.findUnique({ where: { id: mandateId } });
  if (!mandate || mandate.userId !== user.id) throw new Error("Agent task not found.");
  return mandate;
}

/** "Scan now": judge every current listing that fits the task. */
export async function scanAgentMandate(mandateId: string): Promise<{ recorded: number; error?: string }> {
  const mandate = await loadOwnMandate(mandateId);
  if (mandate.status !== "ACTIVE") return { recorded: 0, error: "Resume this task to scan." };
  try {
    const recorded = await runMandate(mandateId, { execute: executeAgentDecision, notify: notifyAgentOwner, offer: sendAgentOffer });
    revalidatePath("/agent");
    return { recorded };
  } catch (err) {
    console.error("Agent scan failed", err);
    return { recorded: 0, error: "The agent couldn't finish this scan. Try again in a moment." };
  }
}

/** Ask-first mode: the user approves one proposed buy, and the agent pays for it. */
export async function approveAgentDecision(decisionId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  const decision = await prisma.agentDecision.findUnique({ where: { id: decisionId }, include: { mandate: true } });
  if (!decision || decision.mandate.userId !== user.id) return { error: "Not found." };
  if (decision.status !== "PROPOSED") return { error: "This suggestion was already handled." };
  await executeAgentDecision(decisionId);
  revalidatePath("/agent");
  const result = await prisma.agentDecision.findUniqueOrThrow({ where: { id: decisionId } });
  return result.status === "EXECUTED" ? {} : { error: result.error ?? "The purchase failed." };
}

export async function declineAgentDecision(decisionId: string) {
  const user = await getCurrentUser();
  await prisma.agentDecision.updateMany({
    where: { id: decisionId, status: "PROPOSED", mandate: { userId: user.id } },
    data: { status: "DECLINED", resolvedAt: new Date() },
  });
  revalidatePath("/agent");
}
