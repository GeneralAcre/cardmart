"use client";

import { useEffect, useState } from "react";

import { useLanguage } from "@/components/landing/language-provider";
import { cn } from "@/lib/utils";

const STEP_MS = 1800;
// Rows shown at once; the middle one lines up with the fixed text.
const VISIBLE = 5;
const MIDDLE = Math.floor(VISIBLE / 2);
// One row's height, in em of the section's font size. Thai needs more room:
// tone marks sit above the line and some vowels below it.
const ROW_EM = { en: 1.15, th: 1.55 } as const;
// Thai sits a touch smaller than English: its glyphs read larger at the same size.
const FONT_SIZE = { en: "clamp(1.5rem, 5.5vw, 6rem)", th: "clamp(1.4rem, 5.25vw, 5.5rem)" } as const;

/**
 * "BUY / SELL / TRADE / … WITH CONFIDENCE": a column of things you can do on
 * CardMart scrolls past a fixed "with confidence", and the word in line with
 * it lights up, so the sentence keeps changing. Each word is a real feature.
 * Holds still on "Buy" for visitors who ask for reduced motion.
 */
export function ConfidenceWords() {
  const { t, locale } = useLanguage();
  const rowEm = ROW_EM[locale];
  const words = t.confidence.words;
  const n = words.length;
  // Three copies so the column can always scroll up; index starts in the middle copy.
  const column = [...words, ...words, ...words];
  const [index, setIndex] = useState<number>(n);
  const [animate, setAnimate] = useState(true);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => {
      setAnimate(true);
      setIndex((i) => i + 1);
    }, STEP_MS);
    return () => clearInterval(timer);
  }, []);

  // After scrolling past the middle copy, jump back to the same word in it
  // without animating, so the loop never runs out.
  useEffect(() => {
    if (index < 2 * n) return;
    const jump = setTimeout(() => {
      setAnimate(false);
      setIndex((i) => i - n);
    }, 700);
    return () => clearTimeout(jump);
  }, [index, n]);

  return (
    <section
      aria-label={`${words.join(", ")} ${t.confidence.tail}`}
      className="relative overflow-hidden py-10 sm:py-14"
    >
      {/* Display size: scales with the screen so the longest line still fits on a
          phone. Centred, so it's balanced in both languages on any width. */}
      <div
        aria-hidden
        className="mx-auto flex max-w-6xl items-center justify-center gap-[0.5em] px-4 leading-none font-black tracking-tight uppercase sm:px-6"
        style={{ fontSize: FONT_SIZE[locale] }}
      >
        <div
          // shrink-0: the column always keeps room for its longest word.
          className="relative shrink-0 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_12%,black_88%,transparent)]"
          style={{ height: `${VISIBLE * rowEm}em` }}
        >
          <ul
            className={cn(animate && "transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]")}
            style={{ transform: `translateY(${(MIDDLE - index) * rowEm}em)` }}
          >
            {column.map((word, i) => (
              <li
                key={i}
                className={cn(
                  "flex items-center whitespace-nowrap transition-colors duration-500",
                  i === index ? "text-highlight" : "text-muted-foreground/70",
                )}
                style={{ height: `${rowEm}em` }}
              >
                {word}
              </li>
            ))}
          </ul>
        </div>
        <span className="whitespace-nowrap">{t.confidence.tail}</span>
      </div>
    </section>
  );
}
