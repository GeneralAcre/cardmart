"use client";

import { Anchor, Sparkles } from "lucide-react";
import type { CardGame, CardLanguage, GradingCompany } from "@prisma/client";

import { Input } from "@/components/ui/input";
import { CARD_GAMES, CARD_GAME_LABELS, CARD_LANGUAGES, CARD_LANGUAGE_LABELS, GRADING_COMPANY_LABELS } from "@/lib/labels";
import { EMPTY_FILTERS, type MarketplaceFilterState } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useT } from "@/components/landing/language-provider";

const GRADING_COMPANIES: GradingCompany[] = ["PSA", "BGS", "CGC", "RAW"];
const GRADES = [10, 9.5, 9, 8.5, 8, 7];
const GAME_ICONS: Record<CardGame, typeof Sparkles> = { POKEMON: Sparkles, ONE_PIECE: Anchor };
const VAULT_OPTIONS: { value: MarketplaceFilterState["vaultedStatus"]; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "IN_VAULT", label: "In Vault" },
  { value: "SHIPPING", label: "Shipping" },
];

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-1.5 text-sm font-medium outline-none transition-colors",
        "focus-visible:ring-ring focus-visible:ring-2",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "text-muted-foreground hover:text-foreground hover:border-foreground/30",
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

  function toggleGradingCompany(company: GradingCompany) {
    const has = filters.gradingCompanies.includes(company);
    onChange({
      ...filters,
      gradingCompanies: has
        ? filters.gradingCompanies.filter((c) => c !== company)
        : [...filters.gradingCompanies, company],
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

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Game switcher — the first thing you pick, like a storefront tab. */}
      <FilterSection label="Card">
        <div className="grid grid-cols-2 gap-2">
          {CARD_GAMES.map((game) => {
            const Icon = GAME_ICONS[game];
            const active = filters.games.includes(game);
            return (
              <button
                key={game}
                type="button"
                aria-pressed={active}
                onClick={() => toggleGame(game)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-full border px-3 py-2 text-sm font-medium outline-none transition-colors",
                  "focus-visible:ring-ring focus-visible:ring-2",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "text-foreground hover:border-foreground/30",
                )}
              >
                <Icon className="size-4" />
                {t(CARD_GAME_LABELS[game])}
              </button>
            );
          })}
        </div>
      </FilterSection>

      <FilterSection label="Storage">
        <div className="flex flex-wrap gap-2">
          {VAULT_OPTIONS.map((option) => (
            <FilterPill
              key={option.value}
              active={filters.vaultedStatus === option.value}
              onClick={() => onChange({ ...filters, vaultedStatus: option.value })}
            >
              {t(option.label)}
            </FilterPill>
          ))}
        </div>
      </FilterSection>

      <FilterSection label="Language">
        <div className="flex flex-wrap gap-2">
          {CARD_LANGUAGES.map((language) => (
            <FilterPill
              key={language}
              active={filters.languages.includes(language)}
              onClick={() => toggleLanguage(language)}
            >
              {t(CARD_LANGUAGE_LABELS[language])}
            </FilterPill>
          ))}
        </div>
      </FilterSection>

      <FilterSection label="Grader">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {GRADING_COMPANIES.map((company) => {
            const active = filters.gradingCompanies.includes(company);
            return (
              <button
                key={company}
                type="button"
                role="checkbox"
                aria-checked={active}
                onClick={() => toggleGradingCompany(company)}
                className="focus-visible:ring-ring flex items-center gap-2.5 rounded text-left text-sm outline-none focus-visible:ring-2"
              >
                <span
                  className={cn(
                    "flex size-[18px] shrink-0 items-center justify-center rounded-full border transition-colors",
                    active ? "border-primary" : "border-muted-foreground/50",
                  )}
                >
                  {active && <span className="bg-primary size-2.5 rounded-full" />}
                </span>
                <span className={active ? "text-foreground" : "text-muted-foreground"}>
                  {t(company === "RAW" ? "Ungraded" : GRADING_COMPANY_LABELS[company])}
                </span>
              </button>
            );
          })}
        </div>
      </FilterSection>

      <FilterSection label="Grade">
        {/* BGS Black Label is a distinct top tier, not a numeric grade of its
            own (it shares grade 10 with a regular Pristine 10 — see
            Asset.isBlackLabel), so it's a separate toggle rather than one
            more entry in GRADES. Listed first to match how it ranks. */}
        <div className="flex flex-wrap gap-2">
          <FilterPill active={filters.blackLabelOnly} onClick={toggleBlackLabel}>
            Black Label
          </FilterPill>
          {GRADES.map((grade) => (
            <FilterPill key={grade} active={filters.grades.includes(grade)} onClick={() => toggleGrade(grade)}>
              {grade}
            </FilterPill>
          ))}
        </div>
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
