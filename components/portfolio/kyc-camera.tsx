"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImageUp, Loader2, RotateCcw, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type KycShotKind = "id" | "selfie";

export interface KycShot {
  blob: Blob;
  previewUrl: string;
}

const MAX_EDGE = 1280;
const SELFIE_COUNTDOWN = 3;

/** Draws a frame onto a canvas at most MAX_EDGE px on its long side and returns a JPEG. */
function toJpeg(source: CanvasImageSource, width: number, height: number, mirror: boolean): Promise<Blob | null> {
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  if (mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
}

const COPY: Record<KycShotKind, { hint: string; ready: string }> = {
  id: {
    hint: "Lay your ID card flat in good light and fit it inside the frame. All four corners and the text must be visible, with no glare.",
    ready: "Card inside the frame and readable? Take the photo.",
  },
  selfie: {
    hint: "Hold your ID card next to your face. Keep your whole face inside the oval and the card's photo visible.",
    ready: "Face in the oval, card beside it? Start the 3-second timer.",
  },
};

/**
 * Live camera capture for identity verification. Uses the rear camera for the
 * ID card and the front camera for the selfie. If the browser can't open a
 * camera at all, it falls back to the phone's own camera app via a file
 * input with `capture`, so the flow still works everywhere.
 */
export function KycCamera({
  kind,
  shot,
  onShot,
}: {
  kind: KycShotKind;
  shot: KycShot | null;
  onShot: (shot: KycShot | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "starting" | "live" | "counting" | "processing" | "unavailable">("idle");
  const [countdown, setCountdown] = useState(SELFIE_COUNTDOWN);
  // True once the <video> is actually delivering frames — capturing before
  // that produces a black photo, so the shutter stays disabled until then.
  const [frameReady, setFrameReady] = useState(false);
  const facing = kind === "id" ? "environment" : "user";
  const mirror = kind === "selfie";

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  async function start() {
    onShot(null);
    setFrameReady(false);
    setStatus("starting");
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      streamRef.current = stream;
      // The <video> element is always mounted (just hidden), so it can take
      // the stream immediately instead of racing a re-render.
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => {});
      }
      setStatus("live");
    } catch {
      setStatus("unavailable");
    }
  }

  const capture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    setStatus("processing");
    const blob = await toJpeg(video, video.videoWidth, video.videoHeight, mirror);
    stop();
    if (!blob) {
      setStatus("unavailable");
      return;
    }
    onShot({ blob, previewUrl: URL.createObjectURL(blob) });
    setStatus("idle");
  }, [mirror, onShot, stop]);

  useEffect(() => {
    if (status !== "counting") return;
    if (countdown <= 0) {
      void capture();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [status, countdown, capture]);

  async function fromFile(file: File | undefined) {
    if (!file) return;
    setStatus("processing");
    try {
      const bitmap = await createImageBitmap(file);
      const blob = await toJpeg(bitmap, bitmap.width, bitmap.height, false);
      if (blob) onShot({ blob, previewUrl: URL.createObjectURL(blob) });
    } finally {
      setStatus("idle");
    }
  }

  const live = status === "live" || status === "counting" || status === "processing";

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">{COPY[kind].hint}</p>

      <div className="bg-muted relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedData={() => setFrameReady(true)}
          className={cn("size-full object-cover", mirror && "-scale-x-100", (!live || shot) && "hidden")}
        />
        {shot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shot.previewUrl} alt={kind === "id" ? "Your ID card" : "Your selfie with ID"} className="size-full object-contain" />
        ) : live ? (
          <>
            {/* Framing guide: a card shape for the ID, an oval for the face. */}
            {kind === "id" ? (
              <div className="pointer-events-none absolute inset-x-[8%] top-1/2 aspect-[1.586] -translate-y-1/2 rounded-xl border-2 border-dashed border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            ) : (
              <div className="pointer-events-none absolute top-1/2 left-[22%] aspect-[3/4] h-[78%] -translate-y-1/2 rounded-[50%] border-2 border-dashed border-white/80" />
            )}
            {status === "counting" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <span className="text-6xl font-bold text-white drop-shadow-lg">{countdown}</span>
              </div>
            )}
            {status === "processing" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <Loader2 className="size-8 animate-spin text-white" />
              </div>
            )}
          </>
        ) : status === "starting" ? (
          <Loader2 className="text-muted-foreground size-8 animate-spin" />
        ) : status === "unavailable" ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 p-6 text-center text-sm">
            <XCircle className="size-7" />
            Couldn&apos;t open the camera here. Allow camera access, or use your phone&apos;s camera app below.
          </div>
        ) : (
          <div className="text-muted-foreground flex flex-col items-center gap-2 p-6 text-center text-sm">
            <Camera className="size-7" />
            {kind === "id" ? "Photo of your ID card" : "Selfie holding your ID card"}
          </div>
        )}
      </div>

      {/* Only mounted when the live camera failed: a capture file input on
          the page can interfere with an open camera stream, so it must not
          exist while getUserMedia is in use. */}
      {status === "unavailable" && (
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture={facing}
          className="hidden"
          onChange={(e) => void fromFile(e.target.files?.[0])}
        />
      )}

      <div className="flex flex-wrap gap-2">
        {shot ? (
          <Button type="button" variant="outline" onClick={start} className="flex-1">
            <RotateCcw /> Retake
          </Button>
        ) : status === "live" ? (
          <>
            <Button type="button" variant="outline" onClick={() => { stop(); setStatus("idle"); }}>
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={!frameReady}
              onClick={() => {
                if (kind === "selfie") {
                  setCountdown(SELFIE_COUNTDOWN);
                  setStatus("counting");
                } else {
                  void capture();
                }
              }}
            >
              <Camera /> {kind === "selfie" ? "Start 3s timer" : "Take photo"}
            </Button>
          </>
        ) : status === "unavailable" ? (
          <>
            <Button type="button" variant="outline" onClick={start}>
              Try again
            </Button>
            <Button type="button" className="flex-1" onClick={() => fileRef.current?.click()}>
              <ImageUp /> Use camera app
            </Button>
          </>
        ) : (
          <Button type="button" className="flex-1" onClick={start} disabled={status === "starting" || status === "counting"}>
            <Camera /> Open camera
          </Button>
        )}
      </div>
      {status === "live" && <p className="text-muted-foreground text-center text-xs">{COPY[kind].ready}</p>}
    </div>
  );
}
