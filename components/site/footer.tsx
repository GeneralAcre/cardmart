import { ShieldCheck } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="text-muted-foreground mx-auto flex max-w-7xl flex-col items-center gap-2 px-4 py-8 text-sm sm:flex-row sm:justify-between sm:px-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4" />
          <span>Phygital Collectibles Marketplace — Physical Escrow &amp; Digital Twin Protocol</span>
        </div>
        <span>Phase 1 · Web2 mock backend · Solana settlement coming in Phase 2</span>
      </div>
    </footer>
  );
}
