"use server";

import { z } from "zod";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const nameSchema = z.string().min(2, "Enter your name.");
const handleSchema = z
  .string()
  .min(3, "Username must be at least 3 characters.")
  .max(24, "Username must be 24 characters or fewer.")
  .regex(/^[a-z0-9_]+$/, "Only lowercase letters, numbers, and underscores.");

const completeProfileSchema = z.object({
  name: nameSchema,
  handle: handleSchema,
  shippingAddress: z.string().min(10, "Enter a full address — we ship real items here."),
  phone: z.string().min(6, "Enter a phone number the courier can reach you on."),
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
    shippingAddress: formData.get("shippingAddress"),
    phone: formData.get("phone"),
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
      shippingAddress: data.shippingAddress,
      phone: data.phone,
      profileComplete: true,
    },
  });

  redirect("/");
}

const updateShippingInfoSchema = z.object({
  shippingAddress: z.string().min(10, "Enter a full address — we ship real items here."),
  phone: z.string().min(6, "Enter a phone number the courier can reach you on."),
});

export interface UpdateShippingInfoState {
  error?: string;
  success?: boolean;
}

export async function updateShippingInfo(
  _prev: UpdateShippingInfoState,
  formData: FormData,
): Promise<UpdateShippingInfoState> {
  const user = await getSessionUser();

  const parsed = updateShippingInfoSchema.safeParse({
    shippingAddress: formData.get("shippingAddress"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid shipping details." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: parsed.data,
  });

  return { success: true };
}

const updateDisplayProfileSchema = z.object({
  name: nameSchema,
  handle: handleSchema,
});

export interface UpdateDisplayProfileState {
  error?: string;
  success?: boolean;
}

export async function updateDisplayProfile(
  _prev: UpdateDisplayProfileState,
  formData: FormData,
): Promise<UpdateDisplayProfileState> {
  const user = await getSessionUser();

  const parsed = updateDisplayProfileSchema.safeParse({
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
    data: { name: data.name, handle: data.handle },
  });

  return { success: true };
}
