"use client";

import { Award, Layers, Search, Star, Wallet } from "lucide-react";
import type { AssetCategory, GradingCompany } from "@prisma/client";

import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS, GRADING_COMPANY_LABELS } from "@/lib/labels";
import { EMPTY_FILTERS, type MarketplaceFilterState } from "@/lib/types";
import { cn } from "@/lib/utils";

const CATEGORIES: AssetCategory[] = ["TRADING_CARD", "SPORTS_CARD", "COMIC"];
const GRADING_COMPANIES: GradingCompany[] = ["PSA", "BGS", "CGC", "RAW"];
const GRADES = [10, 9.5, 9, 8.5, 8, 7];

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
        "rounded-full border px-3 py-1.5 text-sm font-medium outline-none transition-colors",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background text-foreground hover:bg-accent hover:border-foreground/20",
      )}
    >
      {children}
    </button>
  );
}

function FilterSection({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: typeof Search;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-1.5">
        <Icon className="text-muted-foreground size-3.5" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
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
  function toggleCategory(category: AssetCategory) {
    const has = filters.categories.includes(category);
    onChange({
      ...filters,
      categories: has
        ? filters.categories.filter((c) => c !== category)
        : [...filters.categories, category],
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

  return (
    <div className={cn("bg-card flex flex-col gap-5 rounded-xl border p-4 shadow-sm", className)}>
      <div className="relative">
        <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
        <Input
          value={filters.q}
          onChange={(e) => onChange({ ...filters, q: e.target.value })}
          placeholder="Search by name, serial, or seller…"
          className="pl-9"
        />
      </div>

      <Tabs
        value={filters.vaultedStatus}
        onValueChange={(v) => onChange({ ...filters, vaultedStatus: v as MarketplaceFilterState["vaultedStatus"] })}
      >
        <TabsList className="w-full">
          <TabsTrigger value="ALL">All</TabsTrigger>
          <TabsTrigger value="IN_VAULT">In Vault</TabsTrigger>
          <TabsTrigger value="SHIPPING">Shipping</TabsTrigger>
        </TabsList>
      </Tabs>

      <Separator />

      <FilterSection label="Category" icon={Layers}>
        {CATEGORIES.map((category) => (
          <FilterPill
            key={category}
            active={filters.categories.includes(category)}
            onClick={() => toggleCategory(category)}
          >
            {CATEGORY_LABELS[category]}
          </FilterPill>
        ))}
      </FilterSection>

      <FilterSection label="Grading Company" icon={Award}>
        {GRADING_COMPANIES.map((company) => (
          <FilterPill
            key={company}
            active={filters.gradingCompanies.includes(company)}
            onClick={() => toggleGradingCompany(company)}
          >
            {GRADING_COMPANY_LABELS[company]}
          </FilterPill>
        ))}
      </FilterSection>

      <FilterSection label="Grade" icon={Star}>
        {/* BGS Black Label is a distinct top tier, not a numeric grade of its
            own (it shares grade 10 with a regular Pristine 10 — see
            Asset.isBlackLabel), so it's a separate toggle rather than one
            more entry in GRADES. Listed first to match how it ranks. */}
        <FilterPill active={filters.blackLabelOnly} onClick={toggleBlackLabel}>
          Black Label
        </FilterPill>
        {GRADES.map((grade) => (
          <FilterPill key={grade} active={filters.grades.includes(grade)} onClick={() => toggleGrade(grade)}>
            {grade}
          </FilterPill>
        ))}
      </FilterSection>

      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-1.5">
          <Wallet className="text-muted-foreground size-3.5" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Price Range (THB)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="numeric"
            placeholder="Min"
            className="w-28"
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
            placeholder="Max"
            className="w-28"
            value={filters.priceMax ?? ""}
            onChange={(e) =>
              onChange({
                ...filters,
                priceMax: e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
        </div>
      </div>

      {JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS) && (
        <>
          <Separator />
          <Button variant="ghost" size="sm" className="w-fit" onClick={() => onChange(EMPTY_FILTERS)}>
            Clear filters
          </Button>
        </>
      )}
    </div>
  );
}
