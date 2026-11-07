"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  updateDisplayProfile,
  updateShippingInfo,
  type UpdateDisplayProfileState,
  type UpdateShippingInfoState,
} from "@/lib/profile-actions";
import { useLanguage, useT } from "@/components/landing/language-provider";
import { useCurrency } from "@/components/currency-provider";
import { CURRENCIES } from "@/lib/currency";
import { useTheme } from "@/components/site/theme-provider";
import { cn } from "@/lib/utils";

const initial: UpdateDisplayProfileState & UpdateShippingInfoState = {};

// Both forms: show the saved toast, refresh so the header and the rest of
// the app pick up the new name straight away.
function useSavedFeedback(state: { success?: boolean }, message: string) {
  const router = useRouter();
  useEffect(() => {
    if (state.success) {
      toast.success(message);
      router.refresh();
    }
  }, [state, message, router]);
}

export function ProfileForm({ name, handle }: { name: string; handle: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(updateDisplayProfile, initial);
  useSavedFeedback(state, t("Profile updated."));

  return (
    <form action={action} className="flex flex-1 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="settings-name">{t("Display Name")}</Label>
        <Input id="settings-name" name="name" defaultValue={name} required minLength={2} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="settings-handle">{t("Username")}</Label>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">@</span>
          <Input
            id="settings-handle"
            name="handle"
            defaultValue={handle}
            required
            minLength={3}
            maxLength={24}
            pattern="[a-z0-9_]+"
            autoCapitalize="none"
          />
        </div>
      </div>
      {state.error && <p className="text-destructive text-sm">{t(state.error)}</p>}
      <Button type="submit" disabled={pending} className="mt-auto w-full sm:w-fit">
        {pending && <Loader2 className="animate-spin" />}
        {t("Save changes")}
      </Button>
    </form>
  );
}

export function ShippingForm({ address, phone }: { address: string; phone: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(updateShippingInfo, initial);
  useSavedFeedback(state, t("Shipping info updated."));

  return (
    <form action={action} className="flex flex-1 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="settings-address">{t("Shipping Address")}</Label>
        <Textarea
          id="settings-address"
          name="shippingAddress"
          defaultValue={address}
          placeholder={t("Street, city, postal code — where we'll send physical items")}
          required
          minLength={10}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="settings-phone">{t("Phone Number")}</Label>
        <Input
          id="settings-phone"
          name="phone"
          type="tel"
          defaultValue={phone}
          placeholder={t("For the courier to reach you")}
          required
          minLength={6}
        />
      </div>
      {state.error && <p className="text-destructive text-sm">{t(state.error)}</p>}
      <Button type="submit" disabled={pending} className="mt-auto w-full sm:w-fit">
        {pending && <Loader2 className="animate-spin" />}
        {t("Save changes")}
      </Button>
    </form>
  );
}

function Choice<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
}) {
  return (
    // One fixed width for every switcher, split evenly between its options, so
    // Screen mode, Language and Currency line up on both edges.
    <div className="bg-muted grid w-full grid-flow-col auto-cols-fr gap-1 rounded-lg p-1 sm:w-72">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
            value === o.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Screen mode (dark or light), language and price currency; all apply instantly. */
export function AppearanceSettings() {
  const t = useT();
  const { theme, setTheme } = useTheme();
  const { locale, setLocale } = useLanguage();
  const { currency, setCurrency } = useCurrency();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label>{t("Screen mode")}</Label>
        <Choice
          value={theme}
          onChange={setTheme}
          options={[
            { value: "dark", label: t("Dark") },
            { value: "light", label: t("Light") },
          ]}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>{t("Language")}</Label>
        <Choice
          value={locale}
          onChange={setLocale}
          options={[
            { value: "en", label: "English" },
            { value: "th", label: "ไทย" },
          ]}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>{t("Currency")}</Label>
        <Choice value={currency} onChange={setCurrency} options={CURRENCIES.map((c) => ({ value: c.value, label: c.value }))} />
        <p className="text-muted-foreground text-xs">
          {t("Prices are set and paid in baht. USD and SOL are shown at a fixed rate; SOL is what your wallet pays.")}
        </p>
      </div>
    </div>
  );
}
