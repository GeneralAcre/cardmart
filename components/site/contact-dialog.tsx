"use client";

import { ContactForm } from "@/components/site/contact-form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useT } from "@/components/landing/language-provider";

// The footer's "Contact us" link: the support form in a dialog, so the footer
// itself stays a plain set of link columns.
export function ContactDialog({ className }: { className?: string }) {
  const t = useT();
  return (
    <Dialog>
      <DialogTrigger className={className}>{t("Contact us")}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Contact & Support")}</DialogTitle>
          <DialogDescription>{t("Send us a message and we'll reply by email.")}</DialogDescription>
        </DialogHeader>
        <ContactForm />
      </DialogContent>
    </Dialog>
  );
}
