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
  title: "Provenance — Collectibles Marketplace & Digital Twin Vault",
  description:
    "Trade real, certified collectibles secured by physical escrow and digital certificates.",
};

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
