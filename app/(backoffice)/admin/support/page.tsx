import { BackofficePageHeader } from "@/components/backoffice/shell";
import { SupportInbox, type SupportMessageRow } from "@/components/warehouse/support-inbox";
import { getContactMessages } from "@/lib/queries";
import { requireAdmin } from "@/lib/session";
import { getT } from "@/lib/i18n/server";

type Message = Awaited<ReturnType<typeof getContactMessages>>["open"][number];

const toRow = (m: Message): SupportMessageRow => ({
  ...m,
  createdAt: m.createdAt.toISOString(),
  handledAt: m.handledAt?.toISOString() ?? null,
});

export default async function SupportPage() {
  const [, messages, t] = await Promise.all([requireAdmin(), getContactMessages(), getT()]);
  return (
    <div className="mx-auto w-full max-w-3xl">
      <BackofficePageHeader
        title={t("Support inbox")}
        description={t("Messages sent through the contact form in the site footer. Reply by email, then mark them handled.")}
      />
      <SupportInbox open={messages.open.map(toRow)} handled={messages.handled.map(toRow)} />
    </div>
  );
}
