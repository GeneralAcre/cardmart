// A buying task while it's still being set up — shared by the agent chat and
// the task form, and safe to import on both server and client.
import type { AgentTaskInput } from "@/lib/agent-actions";

export const GRADERS = ["PSA", "BGS", "CGC", "RAW"] as const;
export type Grader = (typeof GRADERS)[number];
export type Game = "POKEMON" | "ONE_PIECE";

export const GAME_LABEL: Record<Game, string> = { POKEMON: "Pokémon", ONE_PIECE: "One Piece" };

export interface TaskDraft {
  query: string;
  game: Game | null;
  gradingCompanies: Grader[];
  minGrade: number | null;
  blackLabelOnly: boolean;
  // 0 = not set yet.
  maxPriceThb: number;
  maxCards: number;
  // null = follow max price × cards.
  budgetThb: number | null;
  trustedSellersOnly: boolean;
  autoBuy: boolean;
  makeOffers: boolean;
  fulfillment: "VAULT" | "SHIP";
  notes: string;
}

export const EMPTY_DRAFT: TaskDraft = {
  query: "",
  game: null,
  gradingCompanies: [],
  minGrade: null,
  blackLabelOnly: false,
  maxPriceThb: 0,
  maxCards: 1,
  budgetThb: null,
  trustedSellersOnly: false,
  autoBuy: false,
  makeOffers: false,
  fulfillment: "VAULT",
  notes: "",
};

export const draftBudget = (d: TaskDraft) => d.budgetThb ?? d.maxPriceThb * d.maxCards;

/** What still stops the task from starting, as an untranslated message, or null when it's ready. */
export function draftProblem(d: TaskDraft): string | null {
  if (d.query.trim().length < 2) return "Enter the card to look for.";
  if (!(d.maxPriceThb >= 100)) return "Set a maximum price of at least 100 THB.";
  if (draftBudget(d) < d.maxPriceThb) return "The total budget has to cover at least one card at your maximum price.";
  return null;
}

/** The one-line goal shown on the task card, and the brief the AI judges listings against. */
export function summarizeDraft(d: TaskDraft): string {
  const grade = [
    d.gradingCompanies.filter((g) => g !== "RAW").join("/") || null,
    d.minGrade != null ? (d.minGrade === 10 ? "10" : `${d.minGrade}+`) : null,
    d.blackLabelOnly ? "Black Label" : null,
  ]
    .filter(Boolean)
    .join(" ");
  const raw = d.gradingCompanies.length === 1 && d.gradingCompanies[0] === "RAW" ? "raw " : "";
  const game = d.game ? ` (${GAME_LABEL[d.game]})` : "";
  const count = d.maxCards === 1 ? "one" : String(d.maxCards);
  const total = d.maxCards > 1 ? `, ${draftBudget(d).toLocaleString()} THB in total` : "";
  const offers = d.makeOffers ? ", offering if it's priced higher" : "";
  return `Buy ${count} ${raw}${grade ? `${grade} ` : ""}${d.query.trim()}${game} for up to ${d.maxPriceThb.toLocaleString()} THB each${total}${offers}`;
}

export function draftToTaskInput(d: TaskDraft): AgentTaskInput {
  const summary = summarizeDraft(d);
  const notes = d.notes.trim();
  return {
    instruction: notes ? `${summary}. ${notes}` : summary,
    summary: summary.slice(0, 200),
    query: d.query.trim(),
    game: d.game,
    gradingCompanies: d.gradingCompanies,
    minGrade: d.minGrade,
    blackLabelOnly: d.blackLabelOnly,
    maxPriceThb: d.maxPriceThb,
    budgetThb: draftBudget(d),
    maxCards: d.maxCards,
    trustedSellersOnly: d.trustedSellersOnly,
    autoBuy: d.autoBuy,
    makeOffers: d.makeOffers,
    fulfillment: d.fulfillment,
  };
}
