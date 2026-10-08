import { cn } from "@/lib/utils";
import Image from "next/image";

// The CardMart wordmark — one definition so the app header, landing page and
// standalone pages (onboarding, terms, privacy) always show the same logo.
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-lg font-black italic tracking-tight uppercase sm:text-2xl", className)}>
      <Image
        src="/cardmart-logo.png"
        alt="CardMart logo"
        width={22}
        height={17}
        unoptimized
        className="h-[17px] w-[22px] object-contain sm:h-5 sm:w-[27px]"
      />
      CardMart
    </span>
  );
}
