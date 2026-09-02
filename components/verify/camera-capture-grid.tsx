"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, RotateCcw, Video, XCircle } from "lucide-react";
import type { AssetCategory } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getVerificationChecklist, type VerificationView } from "@/lib/verification-checklist";

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

  function handleCaptured(key: string, dataUrl: string) {
    onChange({ ...captures, [key]: dataUrl });
    setActiveView(null);
  }

  const completedCount = checklist.filter((v) => captures[v.key]).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Live Verification Capture</span>
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
                captured ? "border-emerald-500/50" : "border-dashed hover:bg-accent/40",
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
                <span className="absolute right-1 top-1 rounded-full bg-emerald-500 p-0.5">
                  <CheckCircle2 className="size-3.5 text-white" />
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
          view={activeView}
          onCancel={() => setActiveView(null)}
          onCaptured={(dataUrl) => handleCaptured(activeView.key, dataUrl)}
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
  onCaptured: (dataUrl: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"requesting" | "counting" | "error">("requesting");
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(CAPTURE_HOLD_SECONDS);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setStatus("counting");
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
  }, [view.key]);

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
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onCaptured(dataUrl);
  }, [onCaptured]);

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
              {status === "counting" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <span className="text-5xl font-bold text-white drop-shadow-lg">{countdown}</span>
                </div>
              )}
            </>
          )}
        </div>

        <p className="text-muted-foreground text-center text-xs">
          Hold the item steady in frame — capturing automatically in {countdown}s.
        </p>

        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </DialogContent>
    </Dialog>
  );
}
