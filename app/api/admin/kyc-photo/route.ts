import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { readKycPhoto } from "@/lib/kyc-storage";

/**
 * Staff-only viewer for ID-verification photos, which live in a private Blob
 * store (lib/kyc-storage.ts). The photo is looked up from the user's own row,
 * never from a URL the caller passes in, and is sent with no-store caching so
 * browsers and CDNs never keep a copy.
 */
export async function GET(request: Request) {
  const viewer = await getCurrentUser();
  if (!viewer.isAdmin) return NextResponse.json({ error: "Not allowed." }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const kind = searchParams.get("kind");
  if (!userId || (kind !== "id" && kind !== "selfie")) {
    return NextResponse.json({ error: "Missing userId or kind." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { kycIdPhotoUrl: true, kycSelfieUrl: true },
  });
  const url = kind === "id" ? user?.kycIdPhotoUrl : user?.kycSelfieUrl;
  if (!url) return NextResponse.json({ error: "No photo on file." }, { status: 404 });

  const photo = await readKycPhoto(url);
  if (!photo) return NextResponse.json({ error: "Photo not found in storage." }, { status: 404 });

  return new Response(photo.stream, {
    headers: {
      "Content-Type": photo.contentType,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
