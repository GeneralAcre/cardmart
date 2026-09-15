"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitContactMessage, type ContactMessageState } from "@/lib/contact-actions";

const initialState: ContactMessageState = {};

export function ContactForm() {
  const [state, formAction, pending] = useActionState(submitContactMessage, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      toast.success("Message sent — we'll get back to you soon.");
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <Input name="name" placeholder="Name" required minLength={2} className="bg-background" />
      <Input name="email" type="email" placeholder="Email" required className="bg-background" />
      <Textarea
        name="message"
        placeholder="Message"
        required
        minLength={10}
        rows={3}
        className="bg-background resize-none"
      />
      {state.error && <p className="text-destructive text-xs">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? <Loader2 className="animate-spin" /> : <Send />}
        {pending ? "Sending…" : "Send"}
      </Button>
    </form>
  );
}
