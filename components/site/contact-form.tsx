"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitContactMessage, type ContactMessageState } from "@/lib/contact-actions";
import { useT } from "@/components/landing/language-provider";

const initialState: ContactMessageState = {};

export function ContactForm() {
  const [state, formAction, pending] = useActionState(submitContactMessage, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const t = useT();

  useEffect(() => {
    if (state.success) {
      toast.success(t("Message sent — we'll get back to you soon."));
      formRef.current?.reset();
    }
  }, [state.success, t]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <Input name="name" placeholder={t("Name")} required minLength={2} className="bg-background" />
      <Input name="email" type="email" placeholder={t("Email")} required className="bg-background" />
      <Textarea
        name="message"
        placeholder={t("Message")}
        required
        minLength={10}
        rows={3}
        className="bg-background resize-none"
      />
      {state.error && <p className="text-destructive text-xs">{t(state.error)}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? <Loader2 className="animate-spin" /> : <Send />}
        {pending ? t("Sending…") : t("Send")}
      </Button>
    </form>
  );
}
