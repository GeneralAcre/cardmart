import { redirect } from "next/navigation";
import { Gem } from "lucide-react";

import { getSessionUser } from "@/lib/session";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { suggestHandle } from "@/lib/profile-utils";

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (user.profileComplete) redirect("/");

  const defaultName = user.name ?? "";
  const defaultHandle = suggestHandle(user.email ?? user.name ?? "collector");

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-xl border p-8 shadow-sm">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <Gem className="text-primary size-5" />
          <span>Provenance</span>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Set up your profile</h1>
          <p className="text-muted-foreground text-sm">
            One last step before you can browse, verify, and trade — we need
            a few details to fulfill physical shipments.
          </p>
        </div>
        <OnboardingForm defaultName={defaultName} defaultHandle={defaultHandle} />
      </div>
    </div>
  );
}
