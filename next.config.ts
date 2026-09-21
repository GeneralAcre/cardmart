import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Wildcard subdomain, not one hardcoded store id — Vercel Blob mints a
    // random per-store hostname (e.g. abc123xyz.public.blob.vercel-storage.com),
    // and that id differs between local dev, preview, and production. A
    // fixed hostname would silently break next/image the moment the blob
    // store changes; the wildcard pattern is what actually makes this work
    // automatically across every environment without hand-editing this file.
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
};

export default nextConfig;
