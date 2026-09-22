"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { ZoomIn } from "lucide-react";
import type { AssetCategory, GradingCompany } from "@prisma/client";

import { CardArt } from "@/components/asset/card-art";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Photo {
  id: string;
  viewLabel: string;
  url: string;
}

interface Props {
  themeIndex: number;
  category: AssetCategory;
  gradingCompany: GradingCompany;
  grade: number | null;
  isBlackLabel?: boolean;
  photos: Photo[];
}

// Combines the generated digital-twin art with the real live-camera
// verification photos (front/back/cert-label/corner, however many the
// checklist required) into one selectable gallery — previously only the
// generated art showed up front, with the real photos tucked into a
// separate section far below the fold.
export function ItemGallery({ themeIndex, category, gradingCompany, grade, isBlackLabel, photos }: Props) {
  // Default to the first real photo when one exists — that's what the item
  // actually looks like; the generated art is a stylized fallback/twin.
  const [selectedId, setSelectedId] = useState<string>(photos[0]?.id ?? "twin");
  const [zoomOpen, setZoomOpen] = useState(false);
  const selectedPhoto = photos.find((p) => p.id === selectedId);

  return (
    <div className="flex flex-col gap-3">
      <motion.button
        type="button"
        onClick={() => setZoomOpen(true)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="group relative aspect-[3/4] w-full"
      >
        {selectedPhoto ? (
          <Image
            src={selectedPhoto.url}
            alt={selectedPhoto.viewLabel}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority
            className="rounded-lg border object-cover"
          />
        ) : (
          <CardArt
            themeIndex={themeIndex}
            category={category}
            gradingCompany={gradingCompany}
            grade={grade}
            isBlackLabel={isBlackLabel}
            size="lg"
          />
        )}
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/0 opacity-0 transition-all group-hover:bg-black/20 group-hover:opacity-100">
          <ZoomIn className="size-8 text-white drop-shadow" />
        </div>
      </motion.button>

      {photos.length > 0 && (
        <div className="grid grid-cols-5 gap-2">
          <button
            type="button"
            onClick={() => setSelectedId("twin")}
            className={cn(
              "overflow-hidden rounded-md border-2 transition-colors",
              selectedId === "twin" ? "border-foreground" : "border-transparent hover:border-muted-foreground/30",
            )}
          >
            <CardArt
              themeIndex={themeIndex}
              category={category}
              gradingCompany={gradingCompany}
              grade={grade}
              isBlackLabel={isBlackLabel}
              bordered={false}
              className="aspect-square"
            />
          </button>
          {photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setSelectedId(photo.id)}
              className={cn(
                "relative aspect-square overflow-hidden rounded-md border-2 transition-colors",
                selectedId === photo.id
                  ? "border-foreground"
                  : "border-transparent hover:border-muted-foreground/30",
              )}
            >
              <Image src={photo.url} alt={photo.viewLabel} fill sizes="20vw" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      <p className="text-muted-foreground text-center text-xs">
        {selectedPhoto
          ? `${selectedPhoto.viewLabel} — live camera capture, click to zoom`
          : "Generated certificate artwork — click to zoom"}
      </p>

      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle className="sr-only">
            Zoomed {selectedPhoto ? selectedPhoto.viewLabel : "certificate artwork"}
          </DialogTitle>
          {selectedPhoto ? (
            <div className="relative aspect-square w-full">
              <Image
                src={selectedPhoto.url}
                alt={selectedPhoto.viewLabel}
                fill
                sizes="(max-width: 448px) 100vw, 448px"
                className="rounded-lg object-cover"
              />
            </div>
          ) : (
            <CardArt
              themeIndex={themeIndex}
              category={category}
              gradingCompany={gradingCompany}
              grade={grade}
              isBlackLabel={isBlackLabel}
              size="lg"
              className="aspect-square"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
