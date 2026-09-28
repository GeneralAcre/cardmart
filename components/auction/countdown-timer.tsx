"use client";

import { useEffect, useState } from "react";

import { useT } from "@/components/landing/language-provider";
import type { Translate } from "@/lib/i18n/translate";

function formatRemaining(ms: number, t: Translate): string {
  if (ms <= 0) return t("Ended");
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return t("{d}d {h}h", { d: days, h: hours });
  if (hours > 0) return t("{h}h {m}m", { h: hours, m: minutes });
  if (minutes > 0) return t("{m}m {s}s", { m: minutes, s: seconds });
  return t("{s}s", { s: seconds });
}

// Real client-side countdown, not a static "ends in ~2 days" string — ticks
// every second so it's visibly live. Settlement itself still only ever
// happens server-side (see settleIfExpiredNoBids in lib/queries.ts); this
// never triggers anything on its own, it's display only.
export function CountdownTimer({ endTime, className }: { endTime: string; className?: string }) {
  const target = new Date(endTime).getTime();
  const [remaining, setRemaining] = useState(() => target - Date.now());
  const t = useT();

  useEffect(() => {
    const interval = setInterval(() => setRemaining(target - Date.now()), 1000);
    return () => clearInterval(interval);
  }, [target]);

  return <span className={className}>{formatRemaining(remaining, t)}</span>;
}
