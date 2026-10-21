"use client";

import type { CardGame, CardLanguage, GradingCompany, CardRarity } from "@prisma/client";
import { GameIcon } from "@/components/ui/game-icon";

import { Input } from "@/components/ui/input";
import {
  CARD_GAMES,
  CARD_GAME_BADGE_CLASS,
  CARD_GAME_LABELS,
  CARD_LANGUAGES,
  CARD_LANGUAGE_BADGE_CLASS,
  CARD_LANGUAGE_LABELS,
  GRADING_COMPANY_LABELS,
} from "@/lib/labels";
import { EMPTY_FILTERS, type MarketplaceFilterState } from "@/lib/types";
import { cn } from "@/lib/utils";
import { RARITIES, RARITY_STYLE } from "@/lib/rarity";
import { useT } from "@/components/landing/language-provider";

const GRADING_COMPANIES: GradingCompany[] = ["PSA", "BGS", "CGC", "RAW"];
const GRADES = [10, 9.5, 9, 8.5, 8, 7];
// The grades each grader actually gives, within GRADES: PSA has no 9.5,
// ungraded cards have none. Black Label is BGS only.
const GRADES_BY_COMPANY: Record<GradingCompany, number[]> = {
  PSA: [10, 9, 8.5, 8, 7],
  BGS: GRADES,
  CGC: GRADES,
  RAW: [],
};

// The grade pills to offer for the picked graders; every grade when none are picked.
function gradeOptions(companies: GradingCompany[]) {
  if (companies.length === 0) return { grades: GRADES, blackLabel: true };
  const offered = new Set(companies.flatMap((c) => GRADES_BY_COMPANY[c]));
  return { grades: GRADES.filter((g) => offered.has(g)), blackLabel: companies.includes("BGS") };
}

function FilterPill({
  active,
  onClick,
  children,
  className,
  activeClass = "bg-primary border-primary text-primary-foreground",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  /**
   * The picked look. Game, language and rarity pass the same colour as their
   * tag on the cards (lib/labels.ts, lib/rarity.ts), so picking "SAR" here
   * turns it the yellow every SAR card wears.
   */
  activeClass?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        // Fills its grid cell (no fixed width), so a row of pills is always even and never overlaps.
        // 40px tall on phones for an easier tap, 32px from md up where a pointer is precise.
        "flex h-10 w-full items-center justify-center rounded-full border px-3 text-xs font-semibold outline-none transition-colors md:h-8",
        className,
        "focus-visible:ring-ring focus-visible:ring-2",
        // Picked: a solid fill with the fill's own text colour (black on white in dark mode), so the label stays readable.
        active ? cn("border-transparent", activeClass) : "text-foreground hover:border-foreground/30",
      )}
    >
      {children}
    </button>
  );
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3 border-b py-5 last:border-b-0">
      <span className="eyebrow text-muted-foreground">{t(label)}</span>
      {children}
    </div>
  );
}

export function FilterBar({
  filters,
  onChange,
  className,
}: {
  filters: MarketplaceFilterState;
  onChange: (next: MarketplaceFilterState) => void;
  className?: string;
}) {
  const t = useT();

  function toggleGame(game: CardGame) {
    const has = filters.games.includes(game);
    onChange({
      ...filters,
      games: has ? filters.games.filter((g) => g !== game) : [...filters.games, game],
    });
  }

  function toggleLanguage(language: CardLanguage) {
    const has = filters.languages.includes(language);
    onChange({
      ...filters,
      languages: has ? filters.languages.filter((l) => l !== language) : [...filters.languages, language],
    });
  }

  function toggleRarity(rarity: CardRarity) {
    const has = filters.rarities.includes(rarity);
    onChange({
      ...filters,
      rarities: has ? filters.rarities.filter((r) => r !== rarity) : [...filters.rarities, rarity],
    });
  }

  function toggleGradingCompany(company: GradingCompany) {
    const has = filters.gradingCompanies.includes(company);
    const gradingCompanies = has
      ? filters.gradingCompanies.filter((c) => c !== company)
      : [...filters.gradingCompanies, company];
    // Drop picked grades the new graders don't give, so a hidden pill can't keep filtering.
    const options = gradeOptions(gradingCompanies);
    onChange({
      ...filters,
      gradingCompanies,
      grades: filters.grades.filter((g) => options.grades.includes(g)),
      blackLabelOnly: filters.blackLabelOnly && options.blackLabel,
    });
  }

  function toggleGrade(grade: number) {
    const has = filters.grades.includes(grade);
    onChange({
      ...filters,
      grades: has ? filters.grades.filter((g) => g !== grade) : [...filters.grades, grade],
    });
  }

  function toggleBlackLabel() {
    onChange({ ...filters, blackLabelOnly: !filters.blackLabelOnly });
  }

  const hasSidebarFilters = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);
  const options = gradeOptions(filters.gradingCompanies);

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Game switcher — the first thing you pick, like a storefront tab. */}
      <FilterSection label="Card">
        <div className="grid grid-cols-2 gap-2">
          {CARD_GAMES.map((game) => (
            <FilterPill
              key={game}
              active={filters.games.includes(game)}
              onClick={() => toggleGame(game)}
              activeClass={CARD_GAME_BADGE_CLASS[game]}
              className="gap-1.5"
            >
              <GameIcon game={game} size={16} />
              {t(CARD_GAME_LABELS[game])}
            </FilterPill>
          ))}
        </div>
      </FilterSection>

      <FilterSection label="Language">
        <div className="grid grid-cols-2 gap-2">
          {CARD_LANGUAGES.map((language) => (
            <FilterPill
              key={language}
              active={filters.languages.includes(language)}
              onClick={() => toggleLanguage(language)}
              activeClass={CARD_LANGUAGE_BADGE_CLASS[language]}
            >
              {t(CARD_LANGUAGE_LABELS[language])}
            </FilterPill>
          ))}
        </div>
      </FilterSection>

      <FilterSection label="Rarity">
        {/* A grid, so every rarity pill is the same width however short its label. */}
        <div className="grid grid-cols-4 gap-2">
          {RARITIES.map((r) => (
            <FilterPill
              key={r.value}
              active={filters.rarities.includes(r.value)}
              onClick={() => toggleRarity(r.value)}
              activeClass={RARITY_STYLE[r.value]}
              className="px-0"
            >
              <span title={`${t(r.label)}: ${t(r.description)}`}>{r.short}</span>
            </FilterPill>
          ))}
        </div>
      </FilterSection>

      <FilterSection label="Grader">
        {/* The same pill buttons as every other filter, two to a row like Card and Language, so "Ungraded" has room. */}
        <div className="grid grid-cols-2 gap-2">
          {GRADING_COMPANIES.map((company) => (
            <FilterPill
              key={company}
              active={filters.gradingCompanies.includes(company)}
              onClick={() => toggleGradingCompany(company)}
            >
              {t(company === "RAW" ? "Ungraded" : GRADING_COMPANY_LABELS[company])}
            </FilterPill>
          ))}
        </div>
      </FilterSection>

      <FilterSection label="Grade">
        {/* BGS Black Label is a distinct top tier, not a numeric grade of its
            own (it shares grade 10 with a regular Pristine 10 — see
            Asset.isBlackLabel), so it's a separate toggle rather than one
            more entry in GRADES. Listed first to match how it ranks. Only the
            picked graders' grades show (see gradeOptions). */}
        {options.grades.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("Ungraded cards have no grade.")}</p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {options.blackLabel && (
              <FilterPill active={filters.blackLabelOnly} onClick={toggleBlackLabel} className="col-span-2 px-0">
                Black Label
              </FilterPill>
            )}
            {options.grades.map((grade) => (
              <FilterPill key={grade} active={filters.grades.includes(grade)} onClick={() => toggleGrade(grade)} className="px-0">
                {grade}
              </FilterPill>
            ))}
          </div>
        )}
      </FilterSection>

      <FilterSection label="Price Range (THB)">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="numeric"
            placeholder={t("Min")}
            className="h-10 min-w-0 flex-1 rounded-lg"
            value={filters.priceMin ?? ""}
            onChange={(e) =>
              onChange({
                ...filters,
                priceMin: e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="number"
            inputMode="numeric"
            placeholder={t("Max")}
            className="h-10 min-w-0 flex-1 rounded-lg"
            value={filters.priceMax ?? ""}
            onChange={(e) =>
              onChange({
                ...filters,
                priceMax: e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
        </div>
      </FilterSection>

      {hasSidebarFilters && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className="text-muted-foreground hover:text-foreground w-fit pt-4 text-sm underline underline-offset-4"
        >
          {t("Clear filters")}
        </button>
      )}
    </div>
  );
}
