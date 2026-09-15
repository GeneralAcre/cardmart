"use server";

import { z } from "zod";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const completeProfileSchema = z.object({
  name: z.string().min(2, "Enter your name."),
  handle: z
    .string()
    .min(3, "Username must be at least 3 characters.")
    .max(24, "Username must be 24 characters or fewer.")
    .regex(/^[a-z0-9_]+$/, "Only lowercase letters, numbers, and underscores."),
});

export interface CompleteProfileState {
  error?: string;
}

export async function completeProfile(
  _prev: CompleteProfileState,
  formData: FormData,
): Promise<CompleteProfileState> {
  const user = await getSessionUser();

  const parsed = completeProfileSchema.safeParse({
    name: formData.get("name"),
    handle: formData.get("handle"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid profile details." };
  }
  const data = parsed.data;

  const handleTaken = await prisma.user.findFirst({
    where: { handle: data.handle, NOT: { id: user.id } },
  });
  if (handleTaken) {
    return { error: `Username "${data.handle}" is already taken.` };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name: data.name,
      handle: data.handle,
      profileComplete: true,
    },
  });

  redirect("/");
}
