"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

const contactMessageSchema = z.object({
  name: z.string().min(2, "Enter your name."),
  email: z.string().email("Enter a valid email address."),
  message: z.string().min(10, "Enter a message with at least 10 characters."),
});

export interface ContactMessageState {
  error?: string;
  success?: boolean;
}

// Open to signed-out visitors too — the footer contact form isn't gated
// behind auth, so this intentionally doesn't call getCurrentUser().
export async function submitContactMessage(
  _prev: ContactMessageState,
  formData: FormData,
): Promise<ContactMessageState> {
  const parsed = contactMessageSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    message: formData.get("message"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid message." };
  }

  await prisma.contactMessage.create({ data: parsed.data });
  await prisma.notification.create({
    data: {
      audience: "ADMIN",
      type: "CONTACT_MESSAGE",
      title: "New support message",
      body: `${parsed.data.name} (${parsed.data.email}) wrote in through the contact form.`,
      href: "/admin/support",
    },
  });
  revalidatePath("/admin", "layout");

  return { success: true };
}

/** Staff-only: marks a support message dealt with, or reopens it. */
export async function setContactMessageHandled(id: string, handled: boolean) {
  await requireAdmin();
  await prisma.contactMessage.update({
    where: { id },
    data: { handledAt: handled ? new Date() : null },
  });
  revalidatePath("/admin", "layout");
}
