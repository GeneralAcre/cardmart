import type { Metadata } from "next";
import { Epilogue, Geist_Mono } from "next/font/google";
import "./globals.css";

import { Toaster } from "@/components/ui/sonner";
import { PrivyProvider } from "@/components/providers/privy-provider";

const epilogue = Epilogue({
  variable: "--font-epilogue",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Proof — Collectibles Marketplace & Digital Certificate Vault",
  description:
    "Trade real, certified collectibles protected by secure payments and digital certificates.",
};

// Every page here depends on live session/DB state anyway (via
// getCurrentUser()), so there's no real static-generation benefit to lose.
// More importantly: `next build` tries to statically prerender pages in a
// headless, browser-less context, and Privy's client SDK (wrapping every
// page via PrivyProvider below) isn't designed to run there — it throws
// during that prerender pass. Forcing dynamic rendering skips that
// entirely, which is what actually broke the Vercel build.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${epilogue.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PrivyProvider>
          {children}
          <Toaster position="bottom-right" />
        </PrivyProvider>
      </body>
    </html>
  );
}
