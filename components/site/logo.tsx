import { cn } from "@/lib/utils";

// The CardMart wordmark — one definition so the app header, landing page and
// standalone pages (onboarding, terms, privacy) always show the same logo.
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("text-lg font-black italic tracking-tight uppercase sm:text-2xl", className)}>CardMart</span>
  );
}
