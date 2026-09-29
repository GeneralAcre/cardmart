import { BackofficePageHeader } from "@/components/backoffice/shell";
import { GradingQueue } from "@/components/warehouse/grading-queue";
import { getGradingSubmissionQueue } from "@/lib/queries";
import { requireAdmin } from "@/lib/session";
import { getT } from "@/lib/i18n/server";

export default async function GradingPage() {
  const [, submissions, t] = await Promise.all([requireAdmin(), getGradingSubmissionQueue(), getT()]);
  return (
    <div className="mx-auto w-full max-w-6xl">
      <BackofficePageHeader
        title={t("Grading Submissions")}
        description={t("Full-Service cards on their way to, or back from, the grading company.")}
      />
      <GradingQueue submissions={submissions} />
    </div>
  );
}
