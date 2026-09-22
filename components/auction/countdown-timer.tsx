"use client";

import { useEffect, useState } from "react";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Ended";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

// Real client-side countdown, not a static "ends in ~2 days" string — ticks
// every second so it's visibly live. Settlement itself still only ever
// happens server-side (see settleIfExpiredNoBids in lib/queries.ts); this
// never triggers anything on its own, it's display only.
export function CountdownTimer({ endTime, className }: { endTime: string; className?: string }) {
  const target = new Date(endTime).getTime();
  const [remaining, setRemaining] = useState(() => target - Date.now());

  useEffect(() => {
    const interval = setInterval(() => setRemaining(target - Date.now()), 1000);
    return () => clearInterval(interval);
  }, [target]);

  return <span className={className}>{formatRemaining(remaining)}</span>;
}
