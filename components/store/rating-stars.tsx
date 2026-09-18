import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

interface RatingStarsProps {
  /** Average rating (1-5), or null when the seller has no reviews yet. */
  average: number | null;
  count: number;
  size?: "sm" | "md";
  /** Set false for a single review's own stars, where "(1)" next to it would be redundant. */
  showCount?: boolean;
  className?: string;
}

// Whole-star fill only (no half-star clipping) — simple and honest about
// precision; the exact average is shown alongside as text for anyone who
// wants the real number.
export function RatingStars({ average, count, size = "sm", showCount = true, className }: RatingStarsProps) {
  const starSize = size === "md" ? "size-4" : "size-3.5";

  if (average == null || count === 0) {
    return <span className={cn("text-muted-foreground text-xs", className)}>No ratings yet</span>;
  }

  const filled = Math.round(average);
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={cn(starSize, n <= filled ? "fill-foreground text-foreground" : "text-muted-foreground/25")}
          />
        ))}
      </div>
      {showCount && (
        <span className="text-muted-foreground text-xs">
          {average.toFixed(1)} ({count})
        </span>
      )}
    </div>
  );
}
