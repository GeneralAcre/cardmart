import { formatGrade } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * A graded-card slab drawn around a card picture: the thick clear case with
 * its ridge and recessed window, and the label on top laid out the way real
 * grading labels are (set and number, card name, the grade in words and
 * digits, cert number, barcode). Each grader gets its own label colours so a
 * PSA slab reads differently from a BGS or CGC one at a glance, but it's a
 * drawing: no grading company's logo or label artwork is copied, and the
 * grader appears only as its name.
 *
 * Only for reference pictures and generated art. A real photo of a graded
 * card already shows its own slab, so it's never framed twice.
 */

// Label colours per grader: the frame around the label and the label's ground.
const LABEL: Record<string, { frame: string; ground: string; ink: string; accent: string }> = {
  PSA: { frame: "border-[#c8102e]", ground: "bg-[#fbfbf8]", ink: "text-neutral-900", accent: "text-[#c8102e]" },
  BGS: { frame: "border-[#9aa3ad]", ground: "bg-gradient-to-b from-[#e9edf1] to-[#cdd4dc]", ink: "text-neutral-900", accent: "text-[#1f3a5f]" },
  CGC: { frame: "border-[#1d4f91]", ground: "bg-[#f7f9fc]", ink: "text-neutral-900", accent: "text-[#1d4f91]" },
};
const BLACK_LABEL = { frame: "border-black-label", ground: "bg-neutral-950", ink: "text-white", accent: "text-black-label" };

/** The word graders print beside the number. */
function gradeWord(company: string, grade: number | null, blackLabel?: boolean): string {
  if (grade == null) return "";
  if (blackLabel || (company !== "PSA" && grade === 10)) return "PRISTINE";
  if (grade === 10) return "GEM MT";
  if (grade === 9.5) return "GEM MINT";
  if (grade === 9) return "MINT";
  if (grade === 8.5) return "NM-MT+";
  if (grade >= 8) return "NM-MT";
  if (grade >= 7) return "NM";
  return "EX";
}

const GAME_WORD: Record<string, string> = { POKEMON: "POKEMON", ONE_PIECE: "ONE PIECE" };

/**
 * The label's first and third lines from our "Set — Year" style subtitle:
 * "Base Set — 1999" → "1999 POKEMON" / "BASE SET";
 * "Sword & Shield — Evolving Skies" → "POKEMON SWORD & SHIELD" / "EVOLVING SKIES".
 */
function labelLines(game: string, subtitle: string): { top: string; set: string } {
  const parts = subtitle.split(/\s+[—–-]\s+/).map((p) => p.trim()).filter(Boolean);
  const year = parts.find((p) => /^(19|20)\d\d$/.test(p));
  const rest = parts.filter((p) => p !== year);
  const set = rest.at(-1) ?? "";
  const series = rest.length > 1 ? rest[0] : "";
  return { top: [year, GAME_WORD[game] ?? "", series].filter(Boolean).join(" "), set };
}

export function SlabFrame({
  name,
  subtitle,
  game,
  cardNumber,
  serial,
  gradingCompany,
  grade,
  isBlackLabel,
  className,
  children,
}: {
  name: string;
  subtitle: string;
  /** "POKEMON" or "ONE_PIECE", for the label's first line. */
  game: string;
  cardNumber?: string | null;
  /** e.g. "PSA-12345678"; the digits become the cert number on the label. */
  serial?: string;
  gradingCompany: string;
  grade: number | null;
  isBlackLabel?: boolean;
  className?: string;
  /** The card picture, filling the slab's window. */
  children: React.ReactNode;
}) {
  const label = isBlackLabel ? BLACK_LABEL : (LABEL[gradingCompany] ?? LABEL.PSA);
  const cert = serial?.replace(/^[A-Z]+-/, "") ?? "";
  const lines = labelLines(game, subtitle);

  return (
    // The case, as it looks in a photo: pale clear plastic (about 3 wide by 5
    // tall) with a silvery moulded edge, an inner ridge, a soft drop shadow and
    // a faint diagonal glare across the front.
    <div
      className={cn(
        "relative flex aspect-[3/5] h-full max-w-full flex-col gap-[3.5%] overflow-hidden rounded-[6%/3.6%] p-[5%]",
        "border border-[#c9cfd4] bg-[linear-gradient(180deg,#f3f5f6_0%,#e3e7ea_55%,#eef1f3_100%)]",
        "shadow-[0_16px_32px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.9),inset_0_0_0_4px_rgba(255,255,255,0.35),inset_0_0_0_5px_rgba(0,0,0,0.06)]",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.45)_42%,transparent_54%)]"
      />

      {/* The label, laid out like a real grading label: three lines on the left
          (year and game, card name, set), three on the right (number, grade
          word, grade), all in one plain uppercase size; then the barcode, the
          grader's name and the cert number along the bottom. */}
      <div
        className={cn(
          "relative shrink-0 rounded-[3px] border-solid px-[5%] pt-[3%] pb-[2.5%] text-[6.5px] leading-[1.25] font-medium uppercase",
          label.frame,
          label.ground,
          label.ink,
        )}
        // Inline so the frame and type always apply, even before the dev server's CSS catches up.
        style={{ borderWidth: 2.5, fontFamily: "Arial, Helvetica, sans-serif" }}
      >
        <div className="flex justify-between gap-2">
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{lines.top}</span>
            <span className="truncate">{name}</span>
            <span className="truncate">{lines.set}</span>
          </span>
          <span className="flex shrink-0 flex-col items-end tabular-nums">
            <span>{cardNumber ? `#${cardNumber}` : " "}</span>
            <span>{gradeWord(gradingCompany, grade, isBlackLabel)}</span>
            <span>{formatGrade(grade)}</span>
          </span>
        </div>
        <div className="mt-[2.5%] flex items-center justify-between gap-2">
          {/* A barcode strip, drawn as stripes. */}
          <span
            aria-hidden
            className="block h-[6px] w-[34%] bg-[repeating-linear-gradient(90deg,currentColor_0_1px,transparent_1px_2px,currentColor_2px_4px,transparent_4px_5px)]"
          />
          <span className={cn("shrink-0 text-[7px] font-black tracking-wide", label.accent)}>
            {gradingCompany}
            {isBlackLabel && " BL"}
          </span>
          <span className="w-[34%] text-right tabular-nums">{cert}</span>
        </div>
      </div>

      {/* The clear inner well the card sits in, with a thin margin around it. */}
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-[3px] bg-[#e9edf0] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.10),inset_0_1px_3px_rgba(0,0,0,0.12)]">
        {/* Inline inset: this box sizes the picture, so it must never depend on a generated class. */}
        <div className="absolute" style={{ inset: "3%" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
