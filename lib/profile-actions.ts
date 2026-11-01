"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isOwnUploadUrl } from "@/lib/listing-checks";

const nameSchema = z.string().min(2, "Enter your name.");
const handleSchema = z
  .string()
  .min(3, "Username must be at least 3 characters.")
  .max(24, "Username must be 24 characters or fewer.")
  .regex(/^[a-z0-9_]+$/, "Only lowercase letters, numbers, and underscores.");

const completeProfileSchema = z.object({
  name: nameSchema,
  handle: handleSchema,
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

  // First-time users land on the starter guide rather than the landing page.
  redirect("/guide?welcome=1");
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

/**
 * Sets (or, with null, clears) the user's profile picture. The picture is
 * uploaded straight to our own Blob store from the browser; this only saves
 * its address, and refuses any address that isn't one of our own uploads.
 */
export async function updateProfileImage(url: string | null): Promise<{ error?: string }> {
  const user = await getSessionUser();
  if (url !== null && !isOwnUploadUrl(url)) {
    return { error: "The picture must be uploaded here, not linked from elsewhere." };
  }
  await prisma.user.update({ where: { id: user.id }, data: { image: url } });
  return {};
}

/** Sets (or, with null, clears) the banner behind the user's profile; same rule as the picture. */
export async function updateCoverImage(url: string | null): Promise<{ error?: string }> {
  const user = await getSessionUser();
  if (url !== null && !isOwnUploadUrl(url)) {
    return { error: "The cover must be uploaded here, not linked from elsewhere." };
  }
  await prisma.user.update({ where: { id: user.id }, data: { coverImage: url } });
  revalidatePath("/portfolio");
  revalidatePath(`/store/${user.id}`);
  return {};
}

/** Matches the textarea's maxLength in components/portfolio/profile-header.tsx. */
const BIO_MAX = 160;

/** Saves the short line under the user's name; a blank one removes it. */
export async function updateBio(bio: string): Promise<{ bio: string | null }> {
  const user = await getSessionUser();
  // Keep line breaks (at most one blank line in a row), tidy everything else.
  const clean =
    bio
      .replace(/[^\S\n]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, BIO_MAX) || null;
  await prisma.user.update({ where: { id: user.id }, data: { bio: clean } });
  revalidatePath("/portfolio");
  revalidatePath(`/store/${user.id}`);
  return { bio: clean };
}
