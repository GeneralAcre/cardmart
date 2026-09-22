import { formatDateTime, formatThb } from "@/lib/format";

interface BidRow {
  id: string;
  amountThb: number;
  createdAt: Date;
  bidder: { name: string | null; handle: string | null };
}

export function BidHistory({ bids }: { bids: BidRow[] }) {
  if (bids.length === 0) {
    return <p className="text-muted-foreground text-sm">No bids yet — be the first.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {bids.map((bid, i) => (
        <div key={bid.id} className="bg-card flex items-center justify-between rounded-lg border p-3 text-sm">
          <span className={i === 0 ? "font-semibold" : ""}>
            {bid.bidder.name ?? bid.bidder.handle ?? "A bidder"}
            {i === 0 && <span className="text-muted-foreground ml-1.5 text-xs font-normal">(highest)</span>}
          </span>
          <div className="flex items-center gap-3">
            <span className="font-mono font-semibold tabular-nums">{formatThb(bid.amountThb)}</span>
            <span className="text-muted-foreground text-xs">{formatDateTime(bid.createdAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
