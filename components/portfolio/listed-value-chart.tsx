import { formatThb } from "@/lib/format";

export interface ListedAssetPoint {
  id: string;
  name: string;
  priceThb: number;
}

const MAX_BARS = 6;

// Single series (this seller's own listed items) ranked by price — sequential
// magnitude, one hue, no legend needed per the dataviz skill's form guidance.
export function ListedValueChart({ assets, totalThb }: { assets: ListedAssetPoint[]; totalThb: number }) {
  const sorted = [...assets].sort((a, b) => b.priceThb - a.priceThb);
  const shown = sorted.slice(0, MAX_BARS);
  const remaining = sorted.length - shown.length;
  const max = shown[0]?.priceThb ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="text-muted-foreground text-xs">Listed Value</span>
        <span className="text-lg leading-none font-semibold tracking-tight tabular-nums sm:text-xl">
          {formatThb(totalThb)}
        </span>
      </div>

      {shown.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nothing listed for sale yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {shown.map((asset) => (
            <div key={asset.id} className="flex items-center gap-3">
              <span className="text-muted-foreground w-20 shrink-0 truncate text-xs sm:w-32">{asset.name}</span>
              <div className="bg-muted h-2 min-w-0 flex-1 overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full rounded-full"
                  style={{ width: `${Math.max((asset.priceThb / max) * 100, 4)}%` }}
                />
              </div>
              <span className="text-foreground w-16 shrink-0 text-right text-xs tabular-nums sm:w-20">
                {formatThb(asset.priceThb)}
              </span>
            </div>
          ))}
          {remaining > 0 && (
            <span className="text-muted-foreground text-xs">
              +{remaining} more listed item{remaining === 1 ? "" : "s"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
