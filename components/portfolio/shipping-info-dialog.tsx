"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, MapPin, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateShippingInfo } from "@/lib/profile-actions";
import { useT } from "@/components/landing/language-provider";

export function ShippingInfoDialog({
  shippingAddress,
  phone,
}: {
  shippingAddress: string | null;
  phone: string | null;
}) {
  const router = useRouter();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState(shippingAddress ?? "");
  const [phoneValue, setPhoneValue] = useState(phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("shippingAddress", address);
      fd.set("phone", phoneValue);
      const res = await updateShippingInfo({}, fd);
      if (res.error) {
        setError(res.error);
        return;
      }
      toast.success(t("Shipping info updated."));
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Truck /> {shippingAddress ? t("Edit Shipping Info") : t("Add Shipping Info")}
      </Button>
      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="size-4" />
              {t("Shipping Info")}
            </DialogTitle>
            <DialogDescription>
              {t("This is where we'll send items you buy, and how the courier reaches you.")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="shippingAddress">{t("Shipping Address")}</Label>
              <Textarea
                id="shippingAddress"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={t("Street, city, postal code")}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="phone">{t("Phone Number")}</Label>
              <Input
                id="phone"
                type="tel"
                value={phoneValue}
                onChange={(e) => setPhoneValue(e.target.value)}
                placeholder={t("For the courier to reach you")}
              />
            </div>
            {error && <p className="text-destructive text-sm">{t(error)}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleSave} disabled={pending || address.trim().length < 10 || phoneValue.trim().length < 6}>
              {pending && <Loader2 className="animate-spin" />}
              {t("Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
