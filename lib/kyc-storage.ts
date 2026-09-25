import "server-only";
import { del, get, put } from "@vercel/blob";

// ID-verification photos live in their own PRIVATE Vercel Blob store — never
// in the public store used for listing photos (lib/../app/api/blob/upload),
// where any URL is world-readable. A private blob can only be read with this
// store's token, so the URLs saved on the User row are useless to anyone
// else; staff view the photos through /api/admin/kyc-photo, which checks
// isAdmin and streams them with no-store caching.
//
// Setup (Vercel dashboard → Storage → Create → Blob): choose PRIVATE access,
// connect it to this project with the environment-variable prefix
// "KYC_BLOB", which creates KYC_BLOB_READ_WRITE_TOKEN.

export const KYC_PHOTO_MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function token(): string | undefined {
  return process.env.KYC_BLOB_READ_WRITE_TOKEN?.trim() || undefined;
}

export function isKycPhotoStorageConfigured(): boolean {
  return Boolean(token());
}

export type KycPhotoKind = "id" | "selfie";

/** Validates one uploaded photo; returns an error message, or null when it's fine. */
export function checkKycPhoto(file: FormDataEntryValue | null, label: string): string | null {
  if (!(file instanceof File) || file.size === 0) return `Take the ${label} photo.`;
  if (!ALLOWED_TYPES.includes(file.type)) return `The ${label} photo must be a JPEG, PNG or WebP image.`;
  if (file.size > KYC_PHOTO_MAX_BYTES) return `The ${label} photo is too large (max 3 MB).`;
  return null;
}

export async function saveKycPhoto(userId: string, kind: KycPhotoKind, file: File): Promise<string> {
  const result = await put(`kyc/${userId}/${kind}.jpg`, file, {
    access: "private",
    addRandomSuffix: true,
    contentType: file.type,
    token: token(),
  });
  return result.url;
}

/** Best-effort removal of superseded photos (e.g. when a user resubmits). */
export async function deleteKycPhotos(urls: (string | null | undefined)[]) {
  const existing = urls.filter((u): u is string => Boolean(u));
  if (existing.length === 0 || !token()) return;
  try {
    await del(existing, { token: token() });
  } catch (err) {
    console.warn("[kyc] could not delete old photos:", err);
  }
}

/** Streams a private KYC photo. Callers must have already checked the viewer is staff. */
export async function readKycPhoto(url: string) {
  const result = await get(url, { access: "private", token: token(), useCache: false });
  if (!result || result.statusCode !== 200) return null;
  return { stream: result.stream, contentType: result.blob.contentType };
}
