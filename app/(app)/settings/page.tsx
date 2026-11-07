import { AppearanceSettings, ProfileForm, ShippingForm } from "@/components/settings/settings-forms";
import { ProfilePhoto } from "@/components/settings/profile-photo";
import { getCurrentUser } from "@/lib/session";
import { getT } from "@/lib/i18n/server";

// Account → Settings: the details people set during onboarding, editable.
// Profile comes first; on wide screens the three cards sit side by side
// (two on a laptop, with Appearance below across both).
export default async function SettingsPage() {
  const [user, t] = await Promise.all([getCurrentUser(), getT()]);

  return (
    <div className="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("Settings")}</h1>
        <p className="text-muted-foreground text-sm">{t("Your profile and where we ship physical items.")}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <section className="bg-card flex flex-col gap-4 rounded-xl border p-4 sm:p-6">
          <h2 className="text-base font-semibold">{t("Profile")}</h2>
          <ProfilePhoto image={user.image} name={user.name ?? ""} initials={(user.name ?? user.handle ?? "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()} />
          <ProfileForm name={user.name ?? ""} handle={user.handle ?? ""} />
        </section>
        <section className="bg-card flex flex-col gap-4 rounded-xl border p-4 sm:p-6">
          <h2 className="text-base font-semibold">{t("Shipping")}</h2>
          <ShippingForm address={user.shippingAddress ?? ""} phone={user.phone ?? ""} />
        </section>
        <section className="bg-card flex flex-col gap-4 rounded-xl border p-4 sm:p-6 lg:col-span-2 xl:col-span-1">
          <h2 className="text-base font-semibold">{t("Appearance")}</h2>
          <AppearanceSettings />
        </section>
      </div>
    </div>
  );
}
