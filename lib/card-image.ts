// Which picture represents a card, shared by every card thumbnail. Safe to
// import from client components (no server-only code).
//
// Order: a real live-camera verification photo of this exact copy, then the
// official catalogue image of the card (Asset.catalogImageUrl — a reference
// picture, see lib/card-catalog.ts), then nothing (callers fall back to the
// generated CardArt). Demo seed data stores a 1×1 placeholder pixel as its
// "photos"; those are never shown, since they render as a black square.

const PLACEHOLDER_MARKER = "/seed/placeholder";

export function isRealPhotoUrl(url: string): boolean {
  return !url.includes(PLACEHOLDER_MARKER);
}

/** Real verification photos only (placeholders removed). */
export function realPhotos<T extends { url: string }>(photos: T[] | undefined | null): T[] {
  return (photos ?? []).filter((p) => isRealPhotoUrl(p.url));
}

export interface DisplayImage {
  url: string;
  /** "photo" = real capture of this copy; "reference" = official catalogue image of the card. */
  kind: "photo" | "reference";
}

export function displayImage(asset: {
  verificationPhotos?: { url: string }[] | null;
  catalogImageUrl?: string | null;
}): DisplayImage | undefined {
  const photo = realPhotos(asset.verificationPhotos)[0];
  if (photo) return { url: photo.url, kind: "photo" };
  if (asset.catalogImageUrl) return { url: asset.catalogImageUrl, kind: "reference" };
  return undefined;
}
