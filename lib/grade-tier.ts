/** A card's grade: grader, number and Black Label, e.g. PSA 10 or raw. */
export interface GradeTier {
  gradingCompany: string;
  grade: number | null;
  isBlackLabel: boolean;
}

/** A stable key for a grade, e.g. "PSA:10:" or "BGS:10:BL". */
export const tierKey = (t: GradeTier) => `${t.gradingCompany}:${t.grade ?? ""}:${t.isBlackLabel ? "BL" : ""}`;
