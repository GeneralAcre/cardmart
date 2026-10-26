import { cn } from "@/lib/utils";
import Image from "next/image";

// The CardMart wordmark — one definition so the app header, landing page and
// standalone pages (onboarding, terms, privacy) always show the same logo.
// The image is the whole wordmark (star and name), white on transparent, so
// logo-adaptive turns it dark on the light theme. The star alone, for small
// icon spots, is public/cardmart-star.png.
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center", className)}>
      <Image
        src="/cardmart-logo.png"
        alt="CardMart"
        width={390}
        height={77}
        unoptimized
        priority
        className="logo-adaptive h-6 w-auto sm:h-7"
      />
    </span>
  );
}
