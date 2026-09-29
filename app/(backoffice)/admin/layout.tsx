import type { Metadata } from "next";

import { BackofficeShell } from "@/components/backoffice/shell";
import { getBackofficeCounts } from "@/lib/queries";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: "CardMart Back Office",
  robots: { index: false, follow: false },
};

// The staff back office: its own site chrome (components/backoffice/shell),
// not linked from anywhere on the marketplace. requireAdmin() here keeps
// non-staff out of every page below; each page and every admin Server Action
// still checks again on its own, since a layout check doesn't cover actions.
export default async function BackofficeLayout({ children }: LayoutProps<"/admin">) {
  const [staff, counts] = await Promise.all([requireAdmin(), getBackofficeCounts()]);
  return (
    <BackofficeShell counts={counts} staffName={staff.name ?? staff.handle ?? "Staff"}>
      {children}
    </BackofficeShell>
  );
}
