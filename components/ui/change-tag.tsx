import { cn } from "@/lib/utils";

/** Below this, a move counts as flat: grey, with no arrow. */
const FLAT_PCT = 0.05;

/**
 * The one way a price move is shown: "▲ 4.2%" in green, "▼ 1.0%" in red, or a
 * grey "0.0%" when flat, with the period after it when there is one
 * ("▲ 4.2% 7d"). `pill` puts it on a tinted background for a headline spot
 * (the market index cards); plain is for inline use in lists and cards.
 * Size it with a text class through `className`.
 */
export function ChangeTag({
  pct,
  period,
  pill = false,
  className,
}: {
  /** The change in percent. Null shows a grey "—" (no earlier price to compare). */
  pct: number | null;
  period?: string;
  pill?: boolean;
  className?: string;
}) {
  const flat = pct == null || Math.abs(pct) < FLAT_PCT;
  const up = !flat && pct! > 0;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 font-semibold whitespace-nowrap tabular-nums",
        flat ? "text-muted-foreground" : up ? "text-success" : "text-destructive",
        pill && "rounded-full px-2.5 py-1 text-xs",
        pill && (flat ? "bg-foreground/[0.06]" : up ? "bg-success/15" : "bg-destructive/15"),
        className,
      )}
    >
      {!flat && <span aria-hidden>{up ? "▲" : "▼"}</span>}
      <span className="sr-only">{pct == null ? "" : flat ? "Unchanged" : up ? "Up" : "Down"}</span>
      {pct == null ? "—" : `${Math.abs(pct).toFixed(1)}%`}
      {period && <span className="text-muted-foreground font-normal">{period}</span>}
    </span>
  );
}
