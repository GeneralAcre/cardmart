import { redirect } from "next/navigation";

// The old single-page admin lived here with ?tab=… — older notifications
// still link to it, so send each tab to its new back-office page.
const TAB_TO_PAGE: Record<string, string> = {
  queue: "/admin/inbound",
  grading: "/admin/grading",
  vault: "/admin/vault",
  kyc: "/admin/identity",
  alerts: "/admin/alerts",
  sellers: "/admin/users",
  history: "/admin/history",
  integrations: "/admin/integrations",
};

export default async function LegacyWarehousePage({ searchParams }: PageProps<"/admin/warehouse">) {
  const { tab } = await searchParams;
  redirect((typeof tab === "string" && TAB_TO_PAGE[tab]) || "/admin/inbound");
}
