"use server";

import { z } from "zod";

import { prisma } from "@/lib/prisma";

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

  return { success: true };
}
