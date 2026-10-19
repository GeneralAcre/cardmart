import { AppearanceSettings, ProfileForm, ShippingForm } from "@/components/settings/settings-forms";
import { getCurrentUser } from "@/lib/session";
import { getT } from "@/lib/i18n/server";

// Account → Settings: the details people set during onboarding, editable.
export default async function SettingsPage() {
  const [user, t] = await Promise.all([getCurrentUser(), getT()]);

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("Settings")}</h1>
        <p className="text-muted-foreground text-sm">{t("Your profile and where we ship physical items.")}</p>
      </div>
      <div className="flex flex-col gap-4">
        <section className="bg-card flex flex-col gap-4 rounded-xl border p-4 sm:p-6">
          <h2 className="text-base font-semibold">{t("Appearance")}</h2>
          <AppearanceSettings />
        </section>
        <section className="bg-card flex flex-col gap-4 rounded-xl border p-4 sm:p-6">
          <h2 className="text-base font-semibold">{t("Profile")}</h2>
          <ProfileForm name={user.name ?? ""} handle={user.handle ?? ""} />
        </section>
        <section className="bg-card flex flex-col gap-4 rounded-xl border p-4 sm:p-6">
          <h2 className="text-base font-semibold">{t("Shipping")}</h2>
          <ShippingForm address={user.shippingAddress ?? ""} phone={user.phone ?? ""} />
        </section>
      </div>
    </div>
  );
}
