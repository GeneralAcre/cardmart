"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { AssetCategory, GradingCompany, NotificationType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireAdmin } from "@/lib/session";
import {
  mockMintDigitalTwin,
  mockTransferOwnership,
  mockEscrowInstruction,
} from "@/lib/web3/mock-chain";
import { releaseTradeToSeller, refundTradeToBuyer, getEscrowAuthorityAddress } from "@/lib/web3/escrow-server";
import { mintDigitalTwinToken, transferDigitalTwinToken } from "@/lib/web3/token-server";
import { SELF_MINT_FEE_THB, FULL_SERVICE_PACKAGE_PRICE_THB } from "@/lib/pricing";
import { themeIndexForSerial } from "@/lib/theme";
import { getVerificationChecklist } from "@/lib/verification-checklist";
import { requestDevnetAirdrop } from "@/lib/solana";
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
  // Set only when a real digital-twin token was actually minted — the
  // client uses this to immediately follow up with an owner-signed Approve
  // (see components/verify/self-mint-form.tsx + confirmListingApproval
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
      mockMintTx: mintTxSignature,
      mintAddress,
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
      priceSnapshots: { create: { priceThb: data.priceThb } },
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

  revalidateMarketplace(asset.id);
  return { assetId: asset.id, mintAddress: mintAddress ?? undefined };
}

/**
 * Confirms the seller's post-mint Approve signature (see
 * components/verify/self-mint-form.tsx) — delegates the escrow authority as
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

  // Real on-chain lock when the buyer actually signed one (see
  // components/item/buy-panel.tsx) — falls back to the old simulated
  // signature otherwise, same pattern as everywhere else real signing was
  // added this session.
  const onChain = Boolean(escrowLock);
  const lockSignature = escrowLock?.txSignature ?? (await mockEscrowInstruction("lock", assetId)).txSignature;

  const escrowTx = await prisma.escrowTransaction.create({
    data: {
      assetId,
      buyerId: user.id,
      sellerId: asset.ownerId,
      amountThb: asset.priceThb,
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
      note: `Buyer payment of ${asset.priceThb.toLocaleString()} THB locked in escrow.`,
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
    await notifyUser(
      asset.ownerId,
      "ITEM_SOLD",
      "Item sold",
      `${asset.name} sold instantly from your vault for ${asset.priceThb.toLocaleString()} THB.`,
      `/item/${assetId}`,
    );
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
      `${asset.name} sold for ${asset.priceThb.toLocaleString()} THB and is awaiting warehouse inspection.`,
      `/admin/warehouse`,
    );
  }

  revalidateMarketplace(assetId);
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
  if (asset.marketStatus === "IN_ESCROW") throw new Error("This item is locked in an active sale.");
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
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid grade." };
  }

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
      note: `Full-Service package (${submission.packagePriceThb.toLocaleString()} THB): graded ${submission.gradingCompany} ${parsed.data.grade} by the grading company, digital twin minted by the platform.`,
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
