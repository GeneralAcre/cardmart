import { BackofficePageHeader } from "@/components/backoffice/shell";
import { KycReview, type KycRow } from "@/components/warehouse/kyc-review";
import { getKycQueue } from "@/lib/queries";
import { requireAdmin } from "@/lib/session";
import { getT } from "@/lib/i18n/server";

// The private photo URLs never reach the browser — staff load the photos
// through /api/admin/kyc-photo, which checks isAdmin first.
function toKycRow({ kycIdPhotoUrl, kycSelfieUrl, ...u }: Awaited<ReturnType<typeof getKycQueue>>["pending"][number]): KycRow {
  return {
    ...u,
    hasIdPhoto: Boolean(kycIdPhotoUrl),
    hasSelfie: Boolean(kycSelfieUrl),
    createdAt: u.createdAt.toISOString(),
    kycDateOfBirth: u.kycDateOfBirth?.toISOString() ?? null,
    kycSubmittedAt: u.kycSubmittedAt?.toISOString() ?? null,
    kycReviewedAt: u.kycReviewedAt?.toISOString() ?? null,
  };
}

export default async function IdentityPage() {
  const [, kyc, t] = await Promise.all([requireAdmin(), getKycQueue(), getT()]);
  return (
    <div className="mx-auto w-full max-w-6xl">
      <BackofficePageHeader
        title={t("Identity")}
        description={t("Check each ID photo and selfie against the details the user entered.")}
      />
      <KycReview pending={kyc.pending.map(toKycRow)} reviewed={kyc.reviewed.map(toKycRow)} />
    </div>
  );
}
