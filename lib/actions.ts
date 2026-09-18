"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { AssetCategory, GradingCompany } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireAdmin } from "@/lib/session";
import {
  mockMintDigitalTwin,
  mockTransferOwnership,
  mockEscrowInstruction,
} from "@/lib/web3/mock-chain";
import { SELF_MINT_FEE_THB, FULL_SERVICE_PACKAGE_PRICE_THB } from "@/lib/pricing";
import { themeIndexForSerial } from "@/lib/theme";
import { getVerificationChecklist } from "@/lib/verification-checklist";
import { requestDevnetAirdrop } from "@/lib/solana";
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
  const parsed = createListingSchema.safeParse({
    name: formData.get("name"),
    subtitle: formData.get("subtitle"),
    category: formData.get("category"),
    raw: formData.get("raw"),
    gradingCompany: formData.get("gradingCompany"),
    grade: formData.get("grade") || undefined,
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

  const mint = await mockMintDigitalTwin(serial);

  const asset = await prisma.asset.create({
    data: {
      name: data.name,
      subtitle: data.subtitle,
      category: data.category as AssetCategory,
      gradingCompany: data.gradingCompany as GradingCompany,
      grade: data.raw ? null : data.grade,
      serial,
      themeIndex: themeIndexForSerial(serial),
      priceThb: data.priceThb,
      forSale: true,
      vaulted: false,
      marketStatus: "READY_TO_SHIP",
      pipelineStage: "NONE",
      mockMintTx: mint.txSignature,
      verificationPackage: "SELF_MINT",
      mintFeeThb: SELF_MINT_FEE_THB,
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
    },
  });

  await prisma.provenanceEvent.createMany({
    data: [
      {
        assetId: asset.id,
        type: "MINTED_DIGITAL_TWIN",
        note: data.raw
          ? `Self-Mint package (${SELF_MINT_FEE_THB} THB): raw/ungraded item verified with ${data.photos.length} live camera captures — no grading company involved.`
          : `Self-Mint package (${SELF_MINT_FEE_THB} THB): seller-verified with ${data.photos.length} live camera captures, registered as ${data.gradingCompany} certificate ${serial}.`,
        mockTxSignature: mint.txSignature,
        actorId: user.id,
      },
      {
        assetId: asset.id,
        type: "LISTED",
        note: `Listed for sale at ${data.priceThb.toLocaleString()} THB.`,
        mockTxSignature: mint.txSignature,
        actorId: user.id,
      },
    ],
  });

  revalidateMarketplace(asset.id);
  return { assetId: asset.id };
}

/**
 * Buyer purchases a listing with escrow protection. If the item is already
 * in the vault, ownership transfers instantly (no physical movement). If
 * it's still with the seller, it enters the AWAITING_SELLER_SHIPMENT
 * pipeline; this mock immediately simulates the seller's shipment arriving
 * so the warehouse dashboard has something to inspect.
 */
export async function buyListing(assetId: string, fulfillmentChoice: "SHIP" | "VAULT") {
  const user = await getCurrentUser();
  const asset = await prisma.asset.findUniqueOrThrow({ where: { id: assetId } });

  if (!asset.forSale || asset.priceThb == null) {
    throw new Error("This item is not currently for sale.");
  }
  if (asset.ownerId === user.id) {
    throw new Error("You already own this item.");
  }

  const lock = await mockEscrowInstruction("lock", assetId);
  const escrowTx = await prisma.escrowTransaction.create({
    data: {
      assetId,
      buyerId: user.id,
      sellerId: asset.ownerId,
      amountThb: asset.priceThb,
      fulfillmentChoice,
      status: "LOCKED",
    },
  });
  await prisma.provenanceEvent.create({
    data: {
      assetId,
      type: "ESCROW_LOCKED",
      note: `Buyer payment of ${asset.priceThb.toLocaleString()} THB locked in escrow.`,
      mockTxSignature: lock.txSignature,
      actorId: user.id,
    },
  });

  if (asset.vaulted) {
    // Vault Trading Feature: instant digital transfer, zero shipping.
    const transfer = await mockTransferOwnership(assetId, user.id);
    const release = await mockEscrowInstruction("release", assetId);

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
        note: "Instant vault trade: digital ownership transferred with zero physical movement.",
        mockTxSignature: transfer.txSignature,
        actorId: user.id,
      },
    });
    void release;
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
  }

  revalidateMarketplace(assetId);
}

async function loadInboundPackage(inboundPackageId: string) {
  return prisma.inboundPackage.findUniqueOrThrow({
    where: { id: inboundPackageId },
    include: { asset: true, escrowTx: true },
  });
}

/** Warehouse verifies the slab, then ships it directly to the buyer's address. */
export async function warehouseApproveShip(inboundPackageId: string) {
  await requireAdmin();
  const pkg = await loadInboundPackage(inboundPackageId);
  const transfer = await mockTransferOwnership(pkg.assetId, pkg.escrowTx.buyerId);
  const release = await mockEscrowInstruction("release", pkg.assetId);

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
          mockTxSignature: transfer.txSignature,
        },
        {
          assetId: pkg.assetId,
          type: "DELIVERED_TO_BUYER",
          note: "Shipping label generated and package delivered to buyer's address.",
          mockTxSignature: transfer.txSignature,
        },
        {
          assetId: pkg.assetId,
          type: "OWNERSHIP_TRANSFERRED",
          note: "Digital ownership transferred to buyer; escrow released to seller.",
          mockTxSignature: release.txSignature,
        },
      ],
    }),
  ]);

  revalidateMarketplace(pkg.assetId);
}

/** Warehouse verifies the slab, then deposits it into the platform vault for the buyer. */
export async function warehouseApproveVault(inboundPackageId: string) {
  await requireAdmin();
  const pkg = await loadInboundPackage(inboundPackageId);
  const transfer = await mockTransferOwnership(pkg.assetId, pkg.escrowTx.buyerId);
  const release = await mockEscrowInstruction("release", pkg.assetId);

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
      },
    }),
    prisma.provenanceEvent.createMany({
      data: [
        {
          assetId: pkg.assetId,
          type: "INSPECTION_PASSED",
          note: `Serial and slab authenticity verified against ${pkg.officialGradingCompany} database.`,
          mockTxSignature: transfer.txSignature,
        },
        {
          assetId: pkg.assetId,
          type: "DEPOSITED_TO_VAULT",
          note: "Physical item deposited into the platform vault.",
          mockTxSignature: transfer.txSignature,
        },
        {
          assetId: pkg.assetId,
          type: "OWNERSHIP_TRANSFERRED",
          note: "Digital ownership transferred to buyer; escrow released to seller.",
          mockTxSignature: release.txSignature,
        },
      ],
    }),
  ]);

  revalidateMarketplace(pkg.assetId);
}

/** Warehouse flags a mismatch: refund the buyer and return the item to the seller. */
export async function warehouseReject(inboundPackageId: string) {
  await requireAdmin();
  const pkg = await loadInboundPackage(inboundPackageId);
  const refund = await mockEscrowInstruction("refund", pkg.assetId);

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
          mockTxSignature: refund.txSignature,
        },
        {
          assetId: pkg.assetId,
          type: "ESCROW_REFUNDED",
          note: "Buyer payment refunded in full.",
          mockTxSignature: refund.txSignature,
        },
      ],
    }),
  ]);

  revalidateMarketplace(pkg.assetId);
}

/** Relists a vaulted item for instant, zero-shipping sale. */
export async function vaultRelist(assetId: string, priceThb: number) {
  const user = await getCurrentUser();
  const asset = await prisma.asset.findUniqueOrThrow({ where: { id: assetId } });
  if (asset.ownerId !== user.id) throw new Error("You do not own this item.");
  if (!asset.vaulted) throw new Error("Only vaulted items can be relisted instantly.");

  await prisma.asset.update({
    where: { id: assetId },
    data: { forSale: true, marketStatus: "IN_VAULT", priceThb },
  });
  await prisma.provenanceEvent.create({
    data: {
      assetId,
      type: "RELISTED",
      note: `Relisted for instant sale at ${priceThb.toLocaleString()} THB.`,
      mockTxSignature: (await mockEscrowInstruction("lock", assetId)).txSignature,
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
  return prisma.gradingSubmission.findUniqueOrThrow({ where: { id: submissionId } });
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

const completeGradingSchema = z.object({
  grade: z.coerce.number().min(1).max(10),
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
  const parsed = completeGradingSchema.safeParse({ grade: formData.get("grade") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid grade." };
  }

  const serial = `${submission.gradingCompany}-${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
  const themeIndex = serial.length % 8;
  const mint = await mockMintDigitalTwin(serial);

  const asset = await prisma.asset.create({
    data: {
      name: submission.itemName,
      subtitle: submission.itemSubtitle,
      category: submission.category,
      gradingCompany: submission.gradingCompany,
      grade: parsed.data.grade,
      serial,
      themeIndex,
      forSale: false,
      vaulted: false,
      marketStatus: "DELISTED",
      pipelineStage: "NONE",
      mockMintTx: mint.txSignature,
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
      note: `Full-Service package (${submission.packagePriceThb.toLocaleString()} THB): graded ${submission.gradingCompany} ${parsed.data.grade} by the grading company, digital twin minted by the platform.`,
      mockTxSignature: mint.txSignature,
      actorId: submission.sellerId,
    },
  });

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

/** Dispatches a vaulted item from the warehouse to the owner's home address. */
export async function vaultRedeem(assetId: string) {
  const user = await getCurrentUser();
  const asset = await prisma.asset.findUniqueOrThrow({ where: { id: assetId } });
  if (asset.ownerId !== user.id) throw new Error("You do not own this item.");
  if (!asset.vaulted) throw new Error("This item is not in the vault.");

  const dispatch = await mockEscrowInstruction("release", assetId);
  await prisma.asset.update({
    where: { id: assetId },
    data: {
      vaulted: false,
      forSale: false,
      marketStatus: "DELISTED",
      pipelineStage: "DELIVERED",
    },
  });
  await prisma.provenanceEvent.create({
    data: {
      assetId,
      type: "REDEEMED",
      note: "Physical item dispatched from the warehouse vault to the owner's home address.",
      mockTxSignature: dispatch.txSignature,
      actorId: user.id,
    },
  });

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
