"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateDisplayProfile } from "@/lib/profile-actions";

export function EditProfileDialog({ name, handle }: { name: string; handle: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nameValue, setNameValue] = useState(name);
  const [handleValue, setHandleValue] = useState(handle ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("name", nameValue);
      fd.set("handle", handleValue);
      const res = await updateDisplayProfile({}, fd);
      if (res.error) {
        setError(res.error);
        return;
      }
      toast.success("Profile updated.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-foreground shrink-0 rounded-full p-1 transition-colors"
        aria-label="Edit profile"
      >
        <Pencil className="size-3.5" />
      </button>
      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>Update your display name and username.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-name">Display Name</Label>
              <Input id="edit-name" value={nameValue} onChange={(e) => setNameValue(e.target.value)} minLength={2} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-handle">Username</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">@</span>
                <Input
                  id="edit-handle"
                  value={handleValue}
                  onChange={(e) => setHandleValue(e.target.value.toLowerCase())}
                  minLength={3}
                  maxLength={24}
                  pattern="[a-z0-9_]+"
                  title="Lowercase letters, numbers, and underscores only"
                />
              </div>
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={pending || nameValue.trim().length < 2 || handleValue.trim().length < 3}
            >
              {pending && <Loader2 className="animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
