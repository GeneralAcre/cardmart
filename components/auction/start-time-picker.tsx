"use client";

import { useMemo } from "react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage, useT } from "@/components/landing/language-provider";

// Auctions can be scheduled up to 30 days out (see startAuction), in
// 30-minute steps — a day and a time dropdown in the app's own style instead
// of the browser's native datetime popup.
const MAX_DAYS_AHEAD = 30;
const STEP_MINUTES = 30;
const DEFAULT_TIME = "10:00";
const NOW = "now";

const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function timeSlots(day: string): string[] {
  const now = new Date();
  const isToday = day === dayKey(now);
  const slots: string[] = [];
  for (let m = 0; m < 24 * 60; m += STEP_MINUTES) {
    const time = `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
    if (isToday && new Date(`${day}T${time}`) <= now) continue;
    slots.push(time);
  }
  return slots;
}

/**
 * Value is a local "YYYY-MM-DDTHH:mm" string (what `new Date()` parses as
 * local time), or "" to start the auction immediately.
 */
export function StartTimePicker({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const t = useT();
  const { locale } = useLanguage();
  const [day, time] = value ? value.split("T") : [NOW, ""];

  const days = useMemo(() => {
    const today = new Date();
    const fmt = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    return Array.from({ length: MAX_DAYS_AHEAD }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      const key = dayKey(d);
      const label = i === 0 ? t("Today") : i === 1 ? t("Tomorrow") : fmt.format(d);
      return { key, label };
    }).filter(({ key }) => timeSlots(key).length > 0);
  }, [locale, t]);

  const slots = day === NOW ? [] : timeSlots(day);

  function selectDay(next: string) {
    if (next === NOW) return onChange("");
    const options = timeSlots(next);
    const keep = options.includes(time) ? time : options.includes(DEFAULT_TIME) ? DEFAULT_TIME : options[0];
    onChange(`${next}T${keep}`);
  }

  return (
    <div className="grid grid-cols-[1fr_auto] gap-2">
      <Select value={day} onValueChange={selectDay}>
        <SelectTrigger className="w-full" aria-label={t("Start day")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectItem value={NOW}>{t("Start now")}</SelectItem>
          {days.map(({ key, label }) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={time} onValueChange={(next) => onChange(`${day}T${next}`)} disabled={day === NOW}>
        <SelectTrigger className="w-28 tabular-nums" aria-label={t("Start time")}>
          <SelectValue placeholder="--:--" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {slots.map((slot) => (
            <SelectItem key={slot} value={slot} className="tabular-nums">
              {slot}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
