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
}

export function CardArt({
  themeIndex,
  category,
  gradingCompany,
  grade,
  className,
  size = "sm",
}: CardArtProps) {
  const [from, to] = gradientFor(themeIndex);
  const Icon = CATEGORY_ICONS[category];

  return (
    <div
      className={cn(
        "relative isolate flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-lg",
        className,
      )}
      style={{
        backgroundImage: `radial-gradient(120% 120% at 15% 10%, ${from}dd 0%, ${to}dd 55%, #0f0f12 100%)`,
      }}
    >
      <div
        className="absolute inset-0 opacity-25 mix-blend-overlay"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, rgba(255,255,255,0.35) 0px, rgba(255,255,255,0.35) 1px, transparent 1px, transparent 10px)",
        }}
      />
      <div className="absolute inset-2 rounded-md border border-white/25" />
      <Icon
        className={cn(
          "text-white/90 drop-shadow-sm",
          size === "lg" ? "size-16" : "size-10",
        )}
        strokeWidth={1.5}
      />
      <div className="absolute left-2 top-2 flex items-center gap-1 rounded bg-black/45 px-1.5 py-0.5 backdrop-blur-sm">
        <ShieldCheck className="size-3 text-white" />
        <span className="text-[10px] font-semibold tracking-wide text-white">
          {gradingCompany === "RAW" ? "RAW" : `${gradingCompany} ${formatGrade(grade)}`}
        </span>
      </div>
    </div>
  );
}
