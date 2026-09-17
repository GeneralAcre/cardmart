import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {/* pb-14 clears the fixed MobileBottomNav (h-14) on mobile — sm:pb-0 once it's hidden */}
      <main className="flex flex-1 flex-col pb-14 sm:pb-0">{children}</main>
      <SiteFooter />
    </>
  );
}
