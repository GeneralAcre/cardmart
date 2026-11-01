"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { updateProfileImage } from "@/lib/profile-actions";
import { cropToJpeg } from "@/lib/crop-image";
import { useT } from "@/components/landing/language-provider";

/** The middle square of a photo, as a 512px JPEG. */
export const squareAvatar = (file: File) => cropToJpeg(file, 512, 512);

/** The profile picture, with a button to pick a new one from the gallery or camera, and one to remove it. */
export function ProfilePhoto({ image, name, initials }: { image: string | null; name: string; initials: string }) {
  const t = useT();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function save(url: string | null) {
    const res = await updateProfileImage(url);
    if (res.error) throw new Error(res.error);
    toast.success(url ? t("Photo updated.") : t("Photo removed."));
    router.refresh();
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const blob = await squareAvatar(file);
      const result = await upload(`avatars/${Date.now()}.jpg`, blob, { access: "public", handleUploadUrl: "/api/blob/upload" });
      await save(result.url);
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : t("Could not upload that photo. Try again."));
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    setBusy(true);
    try {
      await save(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Could not remove the photo."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label={t("Change photo")}
        className="group relative shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar className="size-20">
          {image && <AvatarImage src={image} alt={name} className="object-cover" />}
          <AvatarFallback className="text-lg font-medium">{initials}</AvatarFallback>
        </Avatar>
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {busy ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
        </span>
      </button>
      <div className="flex flex-col items-start gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Camera />}
          {image ? t("Change photo") : t("Add photo")}
        </Button>
        {image && (
          <button type="button" onClick={onRemove} disabled={busy} className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2">
            {t("Remove photo")}
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPick} />
    </div>
  );
}
