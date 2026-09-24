"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { Camera, CheckCircle2, Loader2, RotateCcw, Video, XCircle } from "lucide-react";
import type { AssetCategory } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getVerificationChecklist, type VerificationView } from "@/lib/verification-checklist";

// Each value is a Vercel Blob URL, not the raw image — the capture dialog
// uploads directly to Blob storage and only ever hands back the resulting URL.
export type CaptureMap = Record<string, string>;

const CAPTURE_HOLD_SECONDS = 3;

interface CameraCaptureGridProps {
  category: AssetCategory;
  raw?: boolean;
  captures: CaptureMap;
  onChange: (captures: CaptureMap) => void;
}

export function CameraCaptureGrid({ category, raw = false, captures, onChange }: CameraCaptureGridProps) {
  const checklist = getVerificationChecklist(category, raw);
  const [activeView, setActiveView] = useState<VerificationView | null>(null);

  // Chains straight into the next uncaptured view instead of dropping the
  // user back to the grid after every single shot — they're already
  // holding the item in frame, so let them just flip it and keep going.
  function handleCaptured(key: string, url: string) {
    const next = { ...captures, [key]: url };
    onChange(next);
    const remaining = checklist.find((v) => v.key !== key && !next[v.key]);
    setActiveView(remaining ?? null);
  }

  const completedCount = checklist.filter((v) => captures[v.key]).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs">Tap each tile and take a live photo</span>
        <span className="text-muted-foreground text-xs">
          {completedCount} / {checklist.length} captured
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {checklist.map((view) => {
          const captured = captures[view.key];
          return (
            <button
              key={view.key}
              type="button"
              onClick={() => setActiveView(view)}
              className={cn(
                "group relative flex aspect-square flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border text-center transition-colors",
                captured ? "border-success/50" : "border-dashed hover:bg-accent/40",
              )}
            >
              {captured ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={captured} alt={view.label} className="absolute inset-0 size-full object-cover" />
              ) : (
                <Camera className="text-muted-foreground size-6" />
              )}
              <span
                className={cn(
                  "absolute inset-x-0 top-0 truncate px-1.5 py-1 text-[11px] font-medium",
                  captured ? "bg-black/55 text-white" : "text-foreground",
                )}
              >
                {view.label}
              </span>
              {captured && (
                <span className="absolute right-1 top-1 rounded-full bg-success p-0.5">
                  <CheckCircle2 className="text-success-foreground size-3.5" />
                </span>
              )}
              {captured && (
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/55 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                  <RotateCcw className="size-3" /> Retake
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-muted-foreground text-xs">
        Each photo is taken live with your camera — uploads from your gallery
        aren&apos;t accepted, so no one can fake possession with someone
        else&apos;s picture.
      </p>

      {activeView && (
        <CameraCaptureDialog
          key={activeView.key}
          view={activeView}
          onCancel={() => setActiveView(null)}
          onCaptured={(url) => handleCaptured(activeView.key, url)}
        />
      )}
    </div>
  );
}

function CameraCaptureDialog({
  view,
  onCancel,
  onCaptured,
}: {
  view: VerificationView;
  onCancel: () => void;
  onCaptured: (url: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const unmountedRef = useRef(false);
  // "positioning": camera is live but the countdown hasn't started yet —
  // gives the user time to actually pick up and frame the item before
  // anything gets captured, instead of the timer running the instant the
  // camera loads (which is what was making captures come out empty/blurry).
  const [status, setStatus] = useState<"requesting" | "positioning" | "counting" | "uploading" | "error">(
    "requesting",
  );
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(CAPTURE_HOLD_SECONDS);
  // Bumped by the "Try Again" button to re-run the getUserMedia effect below
  // without needing a different view — e.g. after the user grants a
  // permission they'd previously denied.
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function getStream() {
      try {
        // Rear camera first (what you actually want on a phone) — falls
        // back to whatever camera is available otherwise, since laptops
        // used for testing/demoing often have no "environment" camera at
        // all and would otherwise dead-end here every time.
        return await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      } catch {
        return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
    }

    async function start() {
      try {
        const stream = await getStream();
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setStatus("positioning");
      } catch {
        if (!cancelled) {
          setError("Camera access was denied or is unavailable on this device.");
          setStatus("error");
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [view.key, retryToken]);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    const maxWidth = 640;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
    streamRef.current?.getTracks().forEach((t) => t.stop());

    canvas.toBlob(
      async (blob) => {
        if (unmountedRef.current) return;
        if (!blob) {
          setError("Could not process the capture. Try again.");
          setStatus("error");
          return;
        }
        setStatus("uploading");
        try {
          const result = await upload(`verification/${view.key}-${Date.now()}.jpg`, blob, {
            access: "public",
            handleUploadUrl: "/api/blob/upload",
          });
          if (unmountedRef.current) return;
          onCaptured(result.url);
        } catch {
          if (unmountedRef.current) return;
          setError("Upload failed — check your connection and try again.");
          setStatus("error");
        }
      },
      "image/jpeg",
      0.85,
    );
  }, [onCaptured, view.key]);

  useEffect(() => {
    if (status !== "counting") return;
    if (countdown <= 0) {
      capture();
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [status, countdown, capture]);

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-md" showCloseButton={false}>
        <DialogTitle className="flex items-center gap-2 text-base">
          <Video className="size-4" />
          {view.label}
        </DialogTitle>
        <p className="text-muted-foreground text-sm">{view.hint}</p>

        <div className="bg-muted relative flex aspect-square items-center justify-center overflow-hidden rounded-lg">
          {status === "error" ? (
            <div className="text-muted-foreground flex flex-col items-center gap-2 p-6 text-center text-sm">
              <XCircle className="size-8" />
              {error}
            </div>
          ) : (
            <>
              <video ref={videoRef} autoPlay playsInline muted className="size-full object-cover" />
              {/* Positioning guide frame — helps the user see where to hold the item before the countdown starts. */}
              {(status === "positioning" || status === "counting") && (
                <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-dashed border-white/70" />
              )}
              {status === "counting" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <span className="text-5xl font-bold text-white drop-shadow-lg">{countdown}</span>
                </div>
              )}
              {status === "uploading" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40">
                  <Loader2 className="size-8 animate-spin text-white" />
                  <span className="text-sm font-medium text-white">Uploading…</span>
                </div>
              )}
            </>
          )}
        </div>

        <p className="text-muted-foreground text-center text-xs">
          {status === "positioning"
            ? "Hold the item inside the frame, then tap Start when you're ready."
            : status === "uploading"
              ? "Saving your capture…"
              : status === "counting"
                ? `Hold steady — capturing in ${countdown}s.`
                : null}
        </p>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          {status === "positioning" && (
            <Button onClick={() => setStatus("counting")} className="flex-1">
              <Camera /> Start Capture
            </Button>
          )}
          {status === "error" && (
            <Button onClick={() => setRetryToken((t) => t + 1)} className="flex-1">
              <Video /> Try Again
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
