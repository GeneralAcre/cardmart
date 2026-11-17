import { RARITIES, RARITY_STYLE } from "@/lib/rarity";
import { CARD_GAMES, CARD_GAME_BADGE_CLASS, CARD_GAME_LABELS, CARD_LANGUAGES, CARD_LANGUAGE_BADGE_CLASS, CARD_LANGUAGE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { ChangeTag } from "@/components/ui/change-tag";
import { Tag } from "@/components/ui/tag";
import type { Translate } from "@/lib/i18n/translate";

function Section({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section className="bg-card flex flex-col gap-3 rounded-xl border p-4 sm:p-5">
      <div className="flex flex-col gap-1">
        <h3 className="font-semibold">{title}</h3>
        {intro && <p className="text-muted-foreground text-sm">{intro}</p>}
      </div>
      {children}
    </section>
  );
}

/** One row: the tag exactly as it looks on a card, then what it means. */
function Row({ tag, title, body }: { tag: React.ReactNode; title: string; body: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex w-20 shrink-0 justify-start pt-0.5">{tag}</span>
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-muted-foreground text-sm">{body}</span>
      </span>
    </li>
  );
}

// Tag colours: Black Label is gold-on-black (text-black-label), a BGS 10 at
// the top tier is the gold-fill Gold Label (same amber the Market filter pill
// turns), everything else is the plain graded/raw tag.
const TAG_PLAIN = "bg-foreground/90 text-background";
const TAG_GOLD = "bg-amber-400 text-black";
const TAG_BLACK = "text-black-label bg-neutral-900";

// The value ladder, highest first. The three regular 10s get their own ranks
// because the grader really does move the price — for Pokémon a PSA 10 is the
// liquid benchmark, CGC 10 usually sells a little under it, and a non-black
// BGS 10 is rare enough to carry a scarcity premium. Black Label sits on top.
// The order among the top 10s can flip card to card; the bodies say so rather
// than pretend the prices are equal. Keep in sync with lib/queries.ts and
// docs/GRADE_VALUE_TIERS.md.
const GRADE_LADDER: { tags: { text: string; cls: string }[]; title: string; body: string }[] = [
  {
    tags: [{ text: "BL", cls: TAG_BLACK }],
    title: "Black Label",
    body: "A BGS 10 with all four sub-grades a perfect 10. The rarest slab, and the biggest premium in the hobby.",
  },
  {
    tags: [{ text: "BGS 10", cls: TAG_GOLD }],
    title: "Gold Label",
    body: "A true BGS 10 is very rare, so it carries a scarcity premium. Its market is thin, so on some cards a PSA 10 still sells higher.",
  },
  {
    tags: [{ text: "PSA 10", cls: TAG_PLAIN }],
    title: "Gem Mint 10",
    body: "The resale benchmark for Pokémon — the most traded and most liquid 10.",
  },
  {
    tags: [{ text: "CGC 10", cls: TAG_PLAIN }],
    title: "Pristine 10",
    body: "A perfect 10, but usually sells a little under a PSA 10 of the same card.",
  },
  {
    tags: [{ text: "9.5", cls: TAG_PLAIN }],
    title: "Gem Mint 9.5",
    body: "Half a step below a 10, from BGS or CGC. PSA does not give half grades.",
  },
  { tags: [{ text: "9", cls: TAG_PLAIN }], title: "Mint 9", body: "A clean slab from PSA, BGS or CGC." },
  { tags: [{ text: "8.5", cls: TAG_PLAIN }], title: "Near Mint–Mint 8.5", body: "Near Mint–Mint with a small visible flaw." },
  { tags: [{ text: "8", cls: TAG_PLAIN }], title: "Near Mint–Mint 8", body: "A solid mid-grade slab." },
  { tags: [{ text: "7", cls: TAG_PLAIN }], title: "Near Mint 7", body: "Light wear, still graded and protected." },
  { tags: [{ text: "RAW", cls: TAG_PLAIN }], title: "Ungraded", body: "No grade. CardMart checks it by camera before it is listed." },
];

/** The grade value ladder as ranked tiers, highest to lowest. */
function GradeLadder({ t }: { t: Translate }) {
  // Split into two connected columns on wide screens (1–5 | 6–10) so the right
  // half is used instead of sitting empty; one stacked column on phones. The
  // global rank number keeps the overall order unambiguous across columns.
  const mid = Math.ceil(GRADE_LADDER.length / 2);
  const columns = [GRADE_LADDER.slice(0, mid), GRADE_LADDER.slice(mid)];
  return (
    <Section
      title={t("Grade value, highest to lowest")}
      intro={t("The same card is worth more at a higher grade — and the grader matters too. This is the rough order for Pokémon; among the top 10s it can flip from card to card.")}
    >
      <div className="grid gap-x-8 lg:grid-cols-2">
        {columns.map((col, c) => (
          <ol key={c} className="relative flex flex-col">
            {col.map((tier, j) => {
              const n = c * mid + j; // 0-based global rank
              const last = j === col.length - 1;
              return (
                <li key={tier.title} className="relative flex gap-3 pb-2 last:pb-0">
                  {!last && <span aria-hidden className="bg-border absolute top-8 bottom-0 left-3.5 w-px -translate-x-1/2" />}
                  <span className="bg-foreground text-background z-10 mt-1.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                    {n + 1}
                  </span>
                  {/* Fixed-width tag and title columns so the titles and the
                      reason text line up down every row, in both columns. */}
                  <div className="bg-background/40 flex min-w-0 flex-1 flex-col gap-1 rounded-xl border px-3.5 py-2.5 sm:flex-row sm:items-start sm:gap-3">
                    <span className="flex shrink-0 gap-1 sm:w-20">
                      {tier.tags.map((tag) => (
                        <Tag key={tag.text} className={tag.cls}>
                          {tag.text}
                        </Tag>
                      ))}
                    </span>
                    <span className="shrink-0 text-sm font-semibold sm:w-40">{t(tier.title)}</span>
                    <span className="text-muted-foreground min-w-0 flex-1 text-sm">{t(tier.body)}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        ))}
      </div>
    </Section>
  );
}

/** A visual legend for the tags and colours on cards, so nothing needs guessing. */
export function CardGuide({ t, next }: { t: Translate; next?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      {/* The value ladder spans the full width above the tag legend, so the
          whole ranking reads top to bottom in one column. */}
      <GradeLadder t={t} />

      {/* Two columns that stack on their own, so the tall Rarity box doesn't
          leave a gap beside the short ones: Games and Rarity on the left; Grade,
          Language, Price colours and the "next" box on the right. On phones it's
          one column in the same order. */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <Section title={t("Games")} intro={t("The coloured tag above a card's name shows which game it is from.")}>
          <ul className="flex flex-col gap-3">
            {CARD_GAMES.map((g) => (
              <Row
                key={g}
                tag={<Tag className={CARD_GAME_BADGE_CLASS[g]}>{t(CARD_GAME_LABELS[g])}</Tag>}
                title={t(CARD_GAME_LABELS[g])}
                body={g === "POKEMON" ? t("Pokémon cards. Blue tag.") : t("One Piece cards. Ice blue tag.")}
              />
            ))}
          </ul>
        </Section>

        <Section
          title={t("Rarity")}
          intro={t("The tag shows how rare a card is. Common cards are deep green; the rarer the card, the closer the colour gets to bright yellow.")}
        >
          <ul className="flex flex-col gap-3">
            {RARITIES.map((r) => (
              <Row
                key={r.value}
                tag={<Tag className={cn("w-11 px-0", RARITY_STYLE[r.value])}>{r.short}</Tag>}
                title={t(r.label)}
                body={t(r.description)}
              />
            ))}
          </ul>
        </Section>
      </div>

      <div className="flex flex-col gap-4">
        <Section title={t("Grade")} intro={t("Shown on the top-left of the card photo: who graded it and the score out of 10.")}>
          <ul className="flex flex-col gap-3">
            <Row
              tag={<Tag className="bg-foreground/90 text-background">PSA 9</Tag>}
              title={t("Graded card")}
              body={t("A grading company (PSA, BGS or CGC) checked the card and gave it a score. Higher is better.")}
            />
            <Row
              tag={<Tag className="text-black-label bg-neutral-900">BL</Tag>}
              title={t("Black Label")}
              body={t("A perfect 10 on every sub-grade. The rarest grade a card can get.")}
            />
            <Row
              tag={<Tag className="bg-foreground/90 text-background">RAW</Tag>}
              title={t("Ungraded")}
              body={t("Not sent to a grading company. CardMart checks it by camera before it is listed.")}
            />
          </ul>
        </Section>

        <Section title={t("Language")} intro={t("The language printed on the card itself, not the site's language.")}>
          <ul className="flex flex-col gap-3">
            {CARD_LANGUAGES.map((l) => (
              <Row
                key={l}
                tag={<Tag className={CARD_LANGUAGE_BADGE_CLASS[l]}>{t(CARD_LANGUAGE_LABELS[l])}</Tag>}
                title={t(CARD_LANGUAGE_LABELS[l])}
                body={l === "ENGLISH" ? t("English print. Magenta tag.") : t("Japanese print. Pink tag.")}
              />
            ))}
          </ul>
        </Section>

        <Section title={t("Price colours")} intro={t("Green means up, red means down, wherever you see a percentage.")}>
          <ul className="flex flex-col gap-3">
            <Row
              tag={<ChangeTag pct={8.1} className="text-sm" />}
              title={t("Gain")}
              body={t("The card is worth more now than when it was bought or minted.")}
            />
            <Row
              tag={<ChangeTag pct={-1} className="text-sm" />}
              title={t("Loss")}
              body={t("The card is worth less now than when it was bought or minted.")}
            />
          </ul>
        </Section>
        {next}
      </div>
      </div>
    </div>
  );
}
