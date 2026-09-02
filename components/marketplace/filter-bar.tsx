"use client";

import { Search } from "lucide-react";
import type { GradingCompany } from "@prisma/client";

import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { GRADING_COMPANY_LABELS } from "@/lib/labels";
import { EMPTY_FILTERS, type MarketplaceFilterState } from "@/lib/types";

const GRADING_COMPANIES: GradingCompany[] = ["PSA", "BGS", "CGC", "RAW"];
const GRADES = [10, 9.5, 9, 8.5, 8, 7];

export function FilterBar({
  filters,
  onChange,
}: {
  filters: MarketplaceFilterState;
  onChange: (next: MarketplaceFilterState) => void;
}) {
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

  return (
    <div className="bg-card flex flex-col gap-5 rounded-xl border p-4">
      <div className="relative">
        <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
        <Input
          value={filters.q}
          onChange={(e) => onChange({ ...filters, q: e.target.value })}
          placeholder="Search name or serial…"
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

      <div className="flex flex-wrap gap-x-8 gap-y-4">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Grading Company
          </span>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {GRADING_COMPANIES.map((company) => (
              <div key={company} className="flex items-center gap-2">
                <Checkbox
                  id={`gc-${company}`}
                  checked={filters.gradingCompanies.includes(company)}
                  onCheckedChange={() => toggleGradingCompany(company)}
                />
                <Label htmlFor={`gc-${company}`}>{GRADING_COMPANY_LABELS[company]}</Label>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Grade
          </span>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {GRADES.map((grade) => (
              <div key={grade} className="flex items-center gap-2">
                <Checkbox
                  id={`grade-${grade}`}
                  checked={filters.grades.includes(grade)}
                  onCheckedChange={() => toggleGrade(grade)}
                />
                <Label htmlFor={`grade-${grade}`}>{grade}</Label>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Price Range (THB)
          </span>
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
      </div>

      {JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS) && (
        <Button variant="ghost" size="sm" className="w-fit" onClick={() => onChange(EMPTY_FILTERS)}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
