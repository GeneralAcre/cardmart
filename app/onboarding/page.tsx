import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/session";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { suggestHandle } from "@/lib/profile-utils";
import { getT } from "@/lib/i18n/server";

export default async function OnboardingPage() {
  const [user, t] = await Promise.all([getSessionUser(), getT()]);
  if (user.profileComplete) redirect("/");

  const defaultName = user.name ?? "";
  const defaultHandle = suggestHandle(user.email ?? user.name ?? "collector");

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-xl border p-8 shadow-sm">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <span>CardMart</span>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">{t("Set up your profile")}</h1>
          <p className="text-muted-foreground text-sm">
            {t("One last step before you can browse, list, and trade — we need a few details so we can actually ship items to you.")}
          </p>
        </div>
        <OnboardingForm defaultName={defaultName} defaultHandle={defaultHandle} />
      </div>
    </div>
  );
}
