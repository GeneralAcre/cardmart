"use server";

import { z } from "zod";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const completeProfileSchema = z.object({
  name: z.string().min(2, "Enter your name."),
  handle: z
    .string()
    .min(3, "Username must be at least 3 characters.")
    .max(24, "Username must be 24 characters or fewer.")
    .regex(/^[a-z0-9_]+$/, "Only lowercase letters, numbers, and underscores."),
  shippingAddress: z.string().min(10, "Enter a full shipping address."),
  phone: z.string().min(6, "Enter a valid phone number."),
});

export interface CompleteProfileState {
  error?: string;
}

export async function completeProfile(
  _prev: CompleteProfileState,
  formData: FormData,
): Promise<CompleteProfileState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const parsed = completeProfileSchema.safeParse({
    name: formData.get("name"),
    handle: formData.get("handle"),
    shippingAddress: formData.get("shippingAddress"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid profile details." };
  }
  const data = parsed.data;

  const handleTaken = await prisma.user.findFirst({
    where: { handle: data.handle, NOT: { id: session.user.id } },
  });
  if (handleTaken) {
    return { error: `Username "${data.handle}" is already taken.` };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name: data.name,
      handle: data.handle,
      shippingAddress: data.shippingAddress,
      phone: data.phone,
      profileComplete: true,
    },
  });

  redirect("/");
}
