import Image from "next/image";

import type { LandingShowcaseItem } from "@/lib/queries";
import { cn } from "@/lib/utils";

const COLS = 9;
const ROWS = 4;

// A small seeded random generator, so the pile looks the same on every load
// (and on the server and the client) instead of reshuffling.
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SLOTS = (() => {
  const rand = rng(7);
  return Array.from({ length: COLS * ROWS }, (_, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    return {
      // A loose grid with jitter: every spot is covered, none line up.
      left: ((col + 0.5) / COLS) * 100 + (rand() - 0.5) * 9,
      top: ((row + 0.5) / ROWS) * 100 + (rand() - 0.5) * 22,
      rot: Math.round((rand() - 0.5) * 90),
      z: Math.floor(rand() * 6),
      // A few cards sit "further back": softer and dimmer, for depth.
      far: rand() < 0.28,
    };
  });
})();

/**
 * A table covered in cards: live listings thrown down at every angle,
 * overlapping all over the hero, standing still. Every card is a different
 * listing (no repeats); with fewer listings the pile is just sparser.
 * Decorative only, so no links or alt text.
 */
export function CardScatter({ items }: { items: LandingShowcaseItem[] }) {
  // One card per listing, never the same one twice (the same name in two
  // grades counts as the same card here, too).
  const seen = new Set<string>();
  const unique = items.filter((item) => {
    const key = `${item.name}|${item.subtitle}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (unique.length === 0) return null;

  // Fewer cards than spots: use spots spread evenly over the whole hero.
  const count = Math.min(unique.length, SLOTS.length);
  const spots = Array.from({ length: count }, (_, k) => SLOTS[Math.floor((k * SLOTS.length) / count)]);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {spots.map((slot, i) => {
        const item = unique[i];
        return (
          <div
            key={i}
            className={cn("absolute w-[26%] sm:w-[15%] lg:w-[10.5%]", slot.far && "opacity-60 blur-[1.5px]")}
            style={{ left: `${slot.left}%`, top: `${slot.top}%`, translate: "-50% -50%", zIndex: slot.z }}
          >
            <div
              className="card-tilt card-stage relative aspect-[3/4] overflow-hidden rounded-lg border shadow-xl"
              style={{ "--tilt": `${slot.rot}deg` } as React.CSSProperties}
            >
              <Image src={item.imageUrl} alt="" fill sizes="160px" className="object-contain p-1" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
