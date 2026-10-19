import { RARITIES, RARITY_STYLE } from "@/lib/rarity";
import { CARD_GAMES, CARD_GAME_BADGE_CLASS, CARD_GAME_LABELS, CARD_LANGUAGES, CARD_LANGUAGE_BADGE_CLASS, CARD_LANGUAGE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { Translate } from "@/lib/i18n/translate";

const pill = "inline-flex shrink-0 items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold";

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

/** A visual legend for the tags and colours on cards, so nothing needs guessing. */
export function CardGuide({ t }: { t: Translate }) {
  return (
    <div className="flex flex-col gap-4">
      <Section title={t("Games")} intro={t("The coloured tag above a card's name shows which game it is from.")}>
        <ul className="flex flex-col gap-3">
          {CARD_GAMES.map((g) => (
            <Row
              key={g}
              tag={<span className={cn(pill, "rounded", CARD_GAME_BADGE_CLASS[g])}>{t(CARD_GAME_LABELS[g])}</span>}
              title={t(CARD_GAME_LABELS[g])}
              body={g === "POKEMON" ? t("Pokémon cards. Blue tag.") : t("One Piece cards. Red tag.")}
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
              tag={<span className={cn(pill, "rounded-md", RARITY_STYLE[r.value])}>{r.short}</span>}
              title={t(r.label)}
              body={t(r.description)}
            />
          ))}
        </ul>
      </Section>

      <Section title={t("Grade")} intro={t("Shown on the top-left of the card photo: who graded it and the score out of 10.")}>
        <ul className="flex flex-col gap-3">
          <Row
            tag={<span className={cn(pill, "bg-foreground/90 text-background text-[10px]")}>PSA 9</span>}
            title={t("Graded card")}
            body={t("A grading company (PSA, BGS or CGC) checked the card and gave it a score. Higher is better.")}
          />
          <Row
            tag={<span className={cn(pill, "bg-neutral-900 text-[10px] text-amber-400")}>BL</span>}
            title={t("Black Label")}
            body={t("A perfect 10 on every sub-grade. The rarest grade a card can get.")}
          />
          <Row
            tag={<span className={cn(pill, "bg-foreground/90 text-background text-[10px]")}>RAW</span>}
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
              tag={<span className={cn(pill, "rounded", CARD_LANGUAGE_BADGE_CLASS[l])}>{t(CARD_LANGUAGE_LABELS[l])}</span>}
              title={t(CARD_LANGUAGE_LABELS[l])}
              body={l === "ENGLISH" ? t("English print. Yellow tag.") : t("Japanese print. Orange tag.")}
            />
          ))}
        </ul>
      </Section>

      <Section title={t("Price colours")} intro={t("Green means up, red means down, wherever you see a percentage.")}>
        <ul className="flex flex-col gap-3">
          <Row
            tag={<span className="text-success text-sm font-bold tabular-nums">▲ 8.1%</span>}
            title={t("Gain")}
            body={t("The card is worth more now than when it was bought or minted.")}
          />
          <Row
            tag={<span className="text-destructive text-sm font-bold tabular-nums">▼ 1.0%</span>}
            title={t("Loss")}
            body={t("The card is worth less now than when it was bought or minted.")}
          />
        </ul>
      </Section>
    </div>
  );
}
