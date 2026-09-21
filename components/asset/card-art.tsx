import type { AssetCategory, GradingCompany } from "@prisma/client";
import { ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { CATEGORY_ICONS } from "@/lib/theme";
import { gradientFor } from "@/lib/theme";
import { formatGrade } from "@/lib/format";

interface CardArtProps {
  themeIndex: number;
  category: AssetCategory;
  gradingCompany: GradingCompany;
  grade: number | null;
  className?: string;
  size?: "sm" | "lg";
  // Set to false when this is nested inside a container that already owns
  // the visible frame (e.g. a listing card) — otherwise the two rounded
  // borders stack into a "frame within a frame" look.
  bordered?: boolean;
}

export function CardArt({
  themeIndex,
  category,
  gradingCompany,
  grade,
  className,
  size = "sm",
  bordered = true,
}: CardArtProps) {
  const [from, to] = gradientFor(themeIndex);
  const Icon = CATEGORY_ICONS[category];

  return (
    <div
      className={cn(
        "relative isolate flex aspect-[3/4] w-full items-center justify-center overflow-hidden",
        bordered && "rounded-lg border",
        className,
      )}
      style={{
        backgroundImage: `radial-gradient(120% 120% at 15% 10%, ${from} 0%, ${to} 100%)`,
      }}
    >
      <div
        className="absolute inset-0 opacity-[0.06] mix-blend-multiply"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, rgba(0,0,0,0.4) 0px, rgba(0,0,0,0.4) 1px, transparent 1px, transparent 10px)",
        }}
      />
      <div className="absolute inset-2 rounded-md border border-black/10" />
      <Icon
        className={cn(
          "text-neutral-900/20",
          size === "lg" ? "size-16" : "size-10",
        )}
        strokeWidth={1.5}
      />
      <div className="absolute left-2 top-2 flex items-center gap-1 rounded border bg-white/85 px-1.5 py-0.5 shadow-sm backdrop-blur-sm">
        <ShieldCheck className="text-primary size-3" />
        <span className="text-[10px] font-semibold tracking-wide text-neutral-800">
          {gradingCompany === "RAW" ? "RAW" : `${gradingCompany} ${formatGrade(grade)}`}
        </span>
      </div>
    </div>
  );
}
