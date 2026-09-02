"use client";

import { useActionState } from "react";
import { Loader2, UserCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { completeProfile, type CompleteProfileState } from "@/lib/profile-actions";

const initialState: CompleteProfileState = {};

export function OnboardingForm({
  defaultName,
  defaultHandle,
}: {
  defaultName: string;
  defaultHandle: string;
}) {
  const [state, formAction, pending] = useActionState(completeProfile, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Display Name</Label>
        <Input id="name" name="name" defaultValue={defaultName} required minLength={2} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="handle">Username</Label>
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
            title="Lowercase letters, numbers, and underscores only"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="shippingAddress">Shipping Address</Label>
        <Textarea
          id="shippingAddress"
          name="shippingAddress"
          placeholder="House number, street, city, province, postal code"
          required
          minLength={10}
        />
        <p className="text-muted-foreground text-xs">
          Used when the warehouse ships a physical item to you or picks one up for grading.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">Phone Number</Label>
        <Input id="phone" name="phone" type="tel" placeholder="e.g. 08x-xxx-xxxx" required minLength={6} />
      </div>

      {state.error && <p className="text-destructive text-sm">{state.error}</p>}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <UserCheck />}
        {pending ? "Saving…" : "Complete Profile & Continue"}
      </Button>
    </form>
  );
}
