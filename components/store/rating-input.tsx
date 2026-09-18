"use client";

import { useState } from "react";
import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

export function RatingInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const shown = hovered ?? value;

  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHovered(null)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          className="p-0.5"
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
        >
          <Star
            className={cn(
              "size-6 transition-colors",
              n <= shown ? "fill-foreground text-foreground" : "text-muted-foreground/25",
            )}
          />
        </button>
      ))}
    </div>
  );
}
