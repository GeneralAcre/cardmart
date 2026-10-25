"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { ZoomIn } from "lucide-react";
import type { AssetCategory, GradingCompany, PhotoSource } from "@prisma/client";

import { CardArt } from "@/components/asset/card-art";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useT } from "@/components/landing/language-provider";

interface Photo {
  id: string;
  viewLabel: string;
  url: string;
  /** Official catalogue image of the card, not a photo of this copy. */
  reference?: boolean;
  /** Who took it: the seller when listing, or our warehouse at inspection. */
  source?: PhotoSource;
}

interface Props {
  themeIndex: number;
  category: AssetCategory;
  gradingCompany: GradingCompany;
  grade: number | null;
  isBlackLabel?: boolean;
  photos: Photo[];
  /** Official catalogue image (Asset.catalogImageUrl), shown as its own labelled slide. */
  referenceImageUrl?: string | null;
}

/** TCGplayer catalogue images come at 400×400; the same picture at 1000×1000 is sharp enough to zoom into. */
function hiRes(url: string): string {
  return url.replace("product-images.tcgplayer.com/fit-in/400x400/", "product-images.tcgplayer.com/fit-in/1000x1000/");
}

const ZOOM = 2.5;

/**
 * The picture at full size in the zoom window. Click or tap to magnify the
 * spot under the pointer, move to look around, click again to zoom back out.
 */
function ZoomableImage({ src, alt, hint }: { src: string; alt: string; hint: string }) {
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");

  function pointAt(e: React.PointerEvent<HTMLDivElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * 100;
    const y = ((e.clientY - box.top) / box.height) * 100;
    setOrigin(`${Math.min(100, Math.max(0, x))}% ${Math.min(100, Math.max(0, y))}%`);
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        role="button"
        tabIndex={0}
        aria-pressed={zoomed}
        aria-label={hint}
        onPointerDown={pointAt}
        onClick={() => setZoomed((z) => !z)}
        onPointerMove={(e) => zoomed && pointAt(e)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setZoomed((z) => !z);
          }
        }}
        className={cn(
          "relative h-[78vh] w-full overflow-hidden rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring",
          // While zoomed, a finger drag pans the picture instead of scrolling the page.
          zoomed ? "cursor-zoom-out touch-none" : "cursor-zoom-in",
        )}
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 896px) 94vw, 896px"
          className="object-contain transition-transform duration-200 ease-out"
          style={{ transform: zoomed ? `scale(${ZOOM})` : "none", transformOrigin: origin }}
        />
      </div>
      <p className="text-muted-foreground text-center text-xs">{hint}</p>
    </div>
  );
}

// Combines the generated digital-twin art with the real live-camera
// verification photos (front/back/cert-label/corner, however many the
// checklist required) into one selectable gallery — previously only the
// generated art showed up front, with the real photos tucked into a
// separate section far below the fold.
export function ItemGallery({
  themeIndex,
  category,
  gradingCompany,
  grade,
  isBlackLabel,
  photos: capturePhotos,
  referenceImageUrl,
}: Props) {
  // Real captures first, then the official reference image of the card.
  const photos: Photo[] = [
    ...capturePhotos,
    ...(referenceImageUrl ? [{ id: "reference", viewLabel: "Reference image", url: referenceImageUrl, reference: true }] : []),
  ];
  // Default to the first real photo when one exists — that's what the item
  // actually looks like — then the reference image; the generated art is a
  // stylized fallback/twin.
  const [selectedId, setSelectedId] = useState<string>(photos[0]?.id ?? "twin");
  const [zoomOpen, setZoomOpen] = useState(false);
  const t = useT();
  const selectedPhoto = photos.find((p) => p.id === selectedId);

  return (
    <div className="flex flex-col gap-3">
      <motion.button
        type="button"
        onClick={() => setZoomOpen(true)}
        whileTap={{ scale: 0.99 }}
        className="card-stage group relative aspect-[4/5] w-full overflow-hidden rounded-2xl border"
      >
        {/* Shown whole on the dark stage (contain), never cropped. */}
        {selectedPhoto ? (
          <Image
            src={hiRes(selectedPhoto.url)}
            alt={selectedPhoto.viewLabel}
            fill
            sizes="(max-width: 1024px) 100vw, 55vw"
            priority
            className="object-contain p-6 drop-shadow-[0_24px_48px_rgba(0,0,0,0.65)] transition-transform duration-300 group-hover:scale-[1.03] sm:p-10"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-6 sm:p-10">
            <CardArt
              themeIndex={themeIndex}
              category={category}
              gradingCompany={gradingCompany}
              grade={grade}
              isBlackLabel={isBlackLabel}
              size="lg"
              className="h-full w-auto rounded-xl"
            />
          </div>
        )}
        {(selectedPhoto?.reference || selectedPhoto?.source === "WAREHOUSE") && (
          <span className="absolute bottom-3 left-3 rounded-md bg-black/70 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
            {selectedPhoto.reference ? t("Reference image") : t("Photo by CardMart warehouse")}
          </span>
        )}
        <span className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-md bg-black/70 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
          <ZoomIn className="size-4" />
        </span>
      </motion.button>

      {photos.length > 0 && (
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
          <button
            type="button"
            onClick={() => setSelectedId("twin")}
            className={cn(
              "card-stage overflow-hidden rounded-lg border-2 p-1 transition-colors",
              selectedId === "twin" ? "border-foreground" : "border-border hover:border-foreground/30",
            )}
          >
            <CardArt
              themeIndex={themeIndex}
              category={category}
              gradingCompany={gradingCompany}
              grade={grade}
              isBlackLabel={isBlackLabel}
              bordered={false}
              className="aspect-square rounded"
            />
          </button>
          {photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setSelectedId(photo.id)}
              className={cn(
                "card-stage relative aspect-square overflow-hidden rounded-lg border-2 transition-colors",
                selectedId === photo.id
                  ? "border-foreground"
                  : "border-border hover:border-foreground/30",
              )}
            >
              <Image
                src={photo.url}
                alt={photo.viewLabel}
                fill
                sizes="20vw"
                className="object-contain p-1"
              />
            </button>
          ))}
        </div>
      )}

      {!selectedPhoto?.reference && (
        <p className="text-muted-foreground text-center text-xs">
          {selectedPhoto
            ? `${t(selectedPhoto.viewLabel)} — ${
                selectedPhoto.source === "WAREHOUSE"
                  ? t("taken by our warehouse at inspection, click to zoom")
                  : t("live camera capture by the seller, click to zoom")
              }`
            : t("Generated certificate artwork — click to zoom")}
        </p>
      )}

      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        {/* Big enough to read the card: most of the screen, not a small box. */}
        <DialogContent className="max-h-[92vh] w-[min(94vw,56rem)] max-w-none sm:max-w-none">
          <DialogTitle className="sr-only">
            {t("Zoomed {what}", { what: selectedPhoto ? t(selectedPhoto.viewLabel) : t("certificate artwork") })}
          </DialogTitle>
          {selectedPhoto ? (
            <ZoomableImage
              src={hiRes(selectedPhoto.url)}
              alt={selectedPhoto.viewLabel}
              hint={t("Click to zoom in, move to look around, click again to zoom out")}
            />
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
