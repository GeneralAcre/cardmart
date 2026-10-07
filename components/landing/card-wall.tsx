import Image from "next/image";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { formatGrade, formatThb } from "@/lib/format";
import type { LandingShowcaseItem } from "@/lib/queries";
import { cn } from "@/lib/utils";

const COLUMNS = 5;
// Each column needs to be taller than the hero on its own, or the loop
// shows a gap; few live listings just repeat.
const MIN_PER_COLUMN = 6;

function WallTile({ item }: { item: LandingShowcaseItem }) {
  const grade =
    item.gradingCompany === "RAW"
      ? "RAW"
      : `${item.gradingCompany} ${formatGrade(item.grade)}${item.isBlackLabel ? " BL" : ""}`;

  return (
    <div className="bg-card rounded-xl border p-3">
      <div className="card-stage relative aspect-[4/3] overflow-hidden rounded-lg">
        <Image src={item.imageUrl} alt="" fill sizes="240px" className="object-contain p-3" />
      </div>
      <p className="mt-3 truncate text-sm font-medium">{item.name}</p>
      <p className="text-muted-foreground truncate text-xs">{item.subtitle}</p>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground font-mono">{grade}</span>
        <span
          className={cn(
            "flex items-center gap-0.5 font-semibold tabular-nums",
            item.priceDirection === "up" && "text-success",
            item.priceDirection === "down" && "text-destructive",
          )}
        >
          {item.priceDirection === "up" && <ArrowUpRight className="size-3" />}
          {item.priceDirection === "down" && <ArrowDownRight className="size-3" />}
          {item.priceThb != null ? formatThb(item.priceThb) : "—"}
        </span>
      </div>
    </div>
  );
}

// Columns of live listings drifting up and down behind the hero. Purely
// decorative (aria-hidden, no links); each column's list is rendered twice
// and moved by -50% so the loop is seamless.
export function CardWall({ items }: { items: LandingShowcaseItem[] }) {
  if (items.length === 0) return null;

  const columns = Array.from({ length: COLUMNS }, (_, c) => {
    const own = items.filter((_, i) => i % COLUMNS === c);
    const base = own.length > 0 ? own : items;
    const filled: LandingShowcaseItem[] = [];
    for (let i = 0; filled.length < MIN_PER_COLUMN; i++) filled.push(base[(i + c) % base.length]);
    return filled;
  });

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="grid h-full grid-cols-2 gap-4 px-4 sm:grid-cols-3 lg:grid-cols-5">
        {columns.map((column, c) => (
          <div key={c} className={cn("min-w-0", c === 2 && "hidden sm:block", c >= 3 && "hidden lg:block")}>
            <div
              className={cn("flex flex-col gap-4", c % 2 === 0 ? "animate-wall-up" : "animate-wall-down")}
              style={{ animationDuration: `${60 + c * 8}s` }}
            >
              {[...column, ...column].map((item, i) => (
                <WallTile key={`${item.id}-${i}`} item={item} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
