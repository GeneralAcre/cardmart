"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { Camera, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { squareAvatar } from "@/components/settings/profile-photo";
import { useT } from "@/components/landing/language-provider";
import { cropToJpeg } from "@/lib/crop-image";
import { updateBio, updateCoverImage, updateProfileImage } from "@/lib/profile-actions";
import { cn } from "@/lib/utils";

/** Matches BIO_MAX in lib/profile-actions.ts. */
const BIO_MAX = 160;

/** Uploads a picked photo to our Blob store after `prepare` crops it, then saves its address with `save`. */
function usePhotoUpload(
  prepare: (file: File) => Promise<Blob>,
  folder: string,
  save: (url: string | null) => Promise<{ error?: string }>,
) {
  const t = useT();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function run(work: () => Promise<string | null>) {
    setBusy(true);
    try {
      const res = await save(await work());
      if (res.error) throw new Error(res.error);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : t("Could not upload that photo. Try again."));
    } finally {
      setBusy(false);
    }
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        void run(async () => {
          const blob = await prepare(file);
          const result = await upload(`${folder}/${Date.now()}.jpg`, blob, { access: "public", handleUploadUrl: "/api/blob/upload" });
          return result.url;
        });
      }}
    />
  );

  return { busy, input, pick: () => inputRef.current?.click(), remove: () => run(async () => null) };
}

/** Everyone's cover until they upload their own (and again if they remove it). */
const DEFAULT_COVER = "/CardMart-cover.png";

/**
 * The wide banner at the top of a profile: the user's cover photo, or the
 * CardMart cover when they haven't added one. `editable` adds change and
 * remove buttons; removing goes back to the CardMart cover.
 */
export function ProfileCover({ cover, editable = false }: { cover: string | null; editable?: boolean }) {
  const t = useT();
  const { busy, input, pick, remove } = usePhotoUpload((f) => cropToJpeg(f, 1500, 500), "covers", updateCoverImage);

  return (
    <div className="bg-muted relative aspect-[3/1] max-h-64 w-full overflow-hidden rounded-2xl sm:aspect-[4/1]">
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element -- a user upload on Blob storage
        <img src={cover} alt="" className="size-full object-cover" />
      ) : (
        <Image src={DEFAULT_COVER} alt="" fill sizes="(min-width: 1536px) 1536px, 100vw" className="object-cover" priority />
      )}
      {editable && (
        <div className="absolute top-3 right-3 flex gap-2">
          <button
            type="button"
            onClick={pick}
            disabled={busy}
            className="flex h-8 items-center gap-1.5 rounded-full bg-black/55 px-3 text-xs font-medium text-white backdrop-blur transition-colors hover:bg-black/70"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
            {t("Change cover")}
          </button>
          {cover && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              aria-label={t("Remove cover")}
              title={t("Remove cover")}
              className="flex size-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition-colors hover:bg-black/70"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      )}
      {input}
    </div>
  );
}

/** The big round picture that overlaps the cover; `editable` lets you tap it to pick a new one. */
export function ProfileAvatar({
  image,
  name,
  initials,
  editable = false,
  className,
}: {
  image: string | null;
  name: string;
  initials: string;
  editable?: boolean;
  className?: string;
}) {
  const t = useT();
  const { busy, input, pick } = usePhotoUpload(squareAvatar, "avatars", updateProfileImage);
  const avatar = (
    <Avatar className={cn("ring-background bg-background size-24 ring-4 sm:size-32", className)}>
      {image && <AvatarImage src={image} alt={name} className="object-cover" />}
      <AvatarFallback className="text-2xl font-medium sm:text-3xl">{initials}</AvatarFallback>
    </Avatar>
  );
  if (!editable) return avatar;

  return (
    <>
      <button
        type="button"
        onClick={pick}
        disabled={busy}
        aria-label={image ? t("Change photo") : t("Add photo")}
        title={image ? t("Change photo") : t("Add photo")}
        className="group focus-visible:ring-ring relative shrink-0 rounded-full outline-none focus-visible:ring-2"
      >
        {avatar}
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white transition-opacity",
            busy ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
          )}
        >
          {busy ? <Loader2 className="size-6 animate-spin" /> : <Camera className="size-6" />}
        </span>
        {/* Touch screens have no hover, so a small camera badge says it can be changed. */}
        <span className="bg-background text-muted-foreground absolute right-1 bottom-1 flex size-7 items-center justify-center rounded-full border sm:right-2 sm:bottom-2">
          <Camera className="size-3.5" />
        </span>
      </button>
      {input}
    </>
  );
}

/** The bio under a profile's name. Keeps the user's line breaks. */
export function ProfileBio({ bio, className }: { bio: string | null; className?: string }) {
  if (!bio) return null;
  return <p className={cn("max-w-xl text-sm leading-relaxed break-words whitespace-pre-line", className)}>{bio}</p>;
}

/** "Edit profile": a dialog for the bio (name and username stay on the Settings page). */
export function EditProfileButton({ bio }: { bio: string | null }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(bio ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      try {
        await updateBio(draft);
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("Could not save your bio."));
      }
    });
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setDraft(bio ?? "");
          setOpen(true);
        }}
      >
        <Pencil />
        {t("Edit profile")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Edit profile")}</DialogTitle>
            <DialogDescription>
              {t("Change your photo and cover right on your profile. Your name and username are in Settings.")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-bio">{t("Bio")}</Label>
            <Textarea
              id="profile-bio"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={BIO_MAX}
              rows={4}
              placeholder={t("Tell people what you collect")}
              className="resize-none"
            />
            <span className="text-muted-foreground self-end text-xs tabular-nums">
              {draft.length}/{BIO_MAX}
            </span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              {t("Cancel")}
            </Button>
            <Button onClick={save} disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {t("Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
