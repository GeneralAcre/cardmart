import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Identity verification posts two camera photos (each downscaled to
      // ≤1280px JPEG in the browser) with the form — the 1 MB default is too
      // tight. Stays under Vercel's 4.5 MB request limit.
      bodySizeLimit: "4mb",
    },
  },
  images: {
    // Wildcard subdomain, not one hardcoded store id — Vercel Blob mints a
    // random per-store hostname (e.g. abc123xyz.public.blob.vercel-storage.com),
    // and that id differs between local dev, preview, and production. A
    // fixed hostname would silently break next/image the moment the blob
    // store changes; the wildcard pattern is what actually makes this work
    // automatically across every environment without hand-editing this file.
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      // Set artwork and icons for the release calendar (lib/tcg-releases.ts).
      { protocol: "https", hostname: "product-images.tcgplayer.com" },
      { protocol: "https", hostname: "tcgplayer-cdn.tcgplayer.com" },
    ],
  },
};

export default nextConfig;
