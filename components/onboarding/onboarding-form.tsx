"use client";

import { useActionState } from "react";
import { Loader2, UserCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { completeProfile, type CompleteProfileState } from "@/lib/profile-actions";
import { useT } from "@/components/landing/language-provider";

const initialState: CompleteProfileState = {};

export function OnboardingForm({
  defaultName,
  defaultHandle,
}: {
  defaultName: string;
  defaultHandle: string;
}) {
  const [state, formAction, pending] = useActionState(completeProfile, initialState);
  const t = useT();

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{t("Display Name")}</Label>
        <Input id="name" name="name" defaultValue={defaultName} required minLength={2} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="handle">{t("Username")}</Label>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">@</span>
          <Input
            id="handle"
            name="handle"
            defaultValue={defaultHandle}
            required
            minLength={3}
            maxLength={24}
            pattern="[a-z0-9_]+"
            title={t("Lowercase letters, numbers, and underscores only")}
          />
        </div>
        <p className="text-muted-foreground text-xs">{t("Lowercase letters, numbers, and underscores only")}</p>
      </div>

      <div className="flex flex-col gap-1 border-t pt-4">
        <span className="text-xs font-semibold tracking-wide uppercase">{t("Shipping")}</span>
        <p className="text-muted-foreground text-xs">
          {t("Only used to send you physical items you buy, and to return items you sell.")}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="shippingAddress">{t("Shipping Address")}</Label>
        <Textarea
          id="shippingAddress"
          name="shippingAddress"
          placeholder={t("Street, city, postal code — where we'll send physical items")}
          required
          minLength={10}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">{t("Phone Number")}</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          placeholder={t("For the courier to reach you")}
          required
          minLength={6}
        />
      </div>

      {state.error && <p className="text-destructive text-sm">{t(state.error)}</p>}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <UserCheck />}
        {pending ? t("Saving…") : t("Complete Profile & Continue")}
      </Button>
    </form>
  );
}
