import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { verifyPsaCert } from "@/lib/psa";
import { extractPsaCertNumber } from "@/lib/psa-client";

// Standalone endpoint for a separate QA tool (a different repo/app) to check
// whether a serial number is real — paste a serial, get back what PSA's live
// cert database says and whether it's already registered on this platform.
// Purely additive: no existing page or flow calls this, and it never writes
// anything back (read-only lookup, per the current scope).
//
// Auth is a single shared secret (QA_VERIFY_API_KEY) rather than a full user
// account system — appropriate for a small trusted QA team hitting this from
// one internal tool, not a public API.
function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.QA_VERIFY_API_KEY;
  if (!expected) return false;
  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.replace(/^Bearer\s+/i, "").trim();
  return provided.length > 0 && provided === expected;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const serial = typeof body?.serial === "string" ? body.serial.trim() : "";
  if (!serial || serial.length < 4) {
    return NextResponse.json({ error: "A serial number of at least 4 characters is required." }, { status: 400 });
  }

  // Normalizes either a bare cert number or this platform's own
  // "PSA-12345678" format down to the raw number PSA's API expects.
  const certNumber = extractPsaCertNumber(serial);

  const [psaResult, platformAsset] = await Promise.all([
    verifyPsaCert(certNumber),
    prisma.asset.findFirst({
      // Asset.serial is stored in different shapes depending on how it was
      // created (raw self-mint input vs "GRADINGCO-12345678" for
      // Full-Service) — check all the shapes a match could take.
      where: { OR: [{ serial }, { serial: certNumber }, { serial: `PSA-${certNumber}` }] },
      select: {
        id: true,
        name: true,
        subtitle: true,
        category: true,
        gradingCompany: true,
        grade: true,
        serial: true,
        marketStatus: true,
        forSale: true,
        priceThb: true,
        verificationPackage: true,
        createdAt: true,
        seller: { select: { id: true, name: true, handle: true } },
        owner: { select: { id: true, name: true, handle: true } },
      },
    }),
  ]);

  const psa = psaResult.ok
    ? { status: "ok" as const, cert: psaResult.cert }
    : { status: psaResult.reason, cert: null };

  let verdict: "verified" | "not_found" | "unavailable" | "mismatch";
  if (!psaResult.ok) {
    verdict = psaResult.reason;
  } else if (
    platformAsset?.grade != null &&
    psaResult.cert.gradeNumber != null &&
    platformAsset.grade !== psaResult.cert.gradeNumber
  ) {
    // Real cert, but the grade registered on this platform doesn't match
    // what PSA's live records actually say — the strongest single signal
    // of a seller having declared a better grade than they actually have.
    verdict = "mismatch";
  } else {
    verdict = "verified";
  }

  return NextResponse.json({
    serial,
    certNumber,
    psa,
    platformAsset,
    verdict,
  });
}
