import "server-only";
// Claude's two jobs in the buying agent:
//   1. planMandate — turn "find me a PSA 10 Charizard under 20k" into
//      structured search criteria and limits the user then confirms.
//   2. judgeListings — for listings that already pass the hard filters, decide
//      whether each one is really the card the user asked for and a fair
//      price, with a short reason the user can read.
// Claude never sets or overrides a limit: every price/budget/count check runs
// in code before and after it (see lib/agent/engine.ts).
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

const MODEL = "claude-opus-5-5";

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  client ??= new Anthropic();
  return client;
}

export function isAgentAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// Refusal fallbacks are on by default: if a request is declined by a safety
// classifier, the API re-runs it on a fallback model inside the same call.
function withFallback() {
  return { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };
}

// ---------------------------------------------------------------------------
// 1. Planning a mandate
// ---------------------------------------------------------------------------

const GRADERS = ["PSA", "BGS", "CGC", "RAW"] as const;

const MandatePlan = z.object({
  understood: z.boolean().describe("false if the request isn't about buying trading cards"),
  summary: z.string().describe("One short sentence restating the goal, e.g. 'Buy one PSA 10 Charizard ex 151 SIR under 20,000 THB'"),
  query: z.string().describe("The card name to look for, as a seller would title the listing, without grade or price words"),
  game: z.enum(["POKEMON", "ONE_PIECE"]).nullable(),
  gradingCompanies: z.array(z.enum(GRADERS)).describe("Empty means any grader, including raw cards"),
  minGrade: z.number().nullable(),
  blackLabelOnly: z.boolean(),
  maxPriceThb: z.number().int().nullable().describe("Most the user will pay for one card, in THB"),
  budgetThb: z.number().int().nullable().describe("Total the agent may spend across all cards, in THB"),
  maxCards: z.number().int().describe("How many cards to buy in total; 1 unless the user asks for more"),
  trustedSellersOnly: z.boolean().describe("true if the user asks for verified, trusted or well-rated sellers"),
  missing: z.array(z.string()).describe("Anything important the user didn't say, e.g. 'maximum price'"),
});
export type MandatePlan = z.infer<typeof MandatePlan>;

const PLAN_SYSTEM = `You set up a buying agent on CardMart, a Thai marketplace for graded and raw Pokémon and One Piece trading cards. Prices are in Thai baht (THB). Write amounts as "20,000 THB", never with the ฿ sign.

Turn the user's request into search criteria and spending limits. Read "k" as thousands (20k = 20000). If the user gives one price, it is the maximum per card, and the budget is that price times the number of cards unless they say otherwise. Never invent a price the user didn't give — leave it null and list it in "missing". Grades run 1–10 (BGS also has half grades); "gem mint" means 10. Always write the summary and the "missing" items in English.`;

export async function planMandate(instruction: string): Promise<MandatePlan> {
  const response = await anthropic().beta.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    ...withFallback(),
    output_config: { effort: "low", format: betaZodOutputFormat(MandatePlan) },
    system: PLAN_SYSTEM,
    messages: [{ role: "user", content: instruction }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error("The agent couldn't understand that request. Try describing the card and your maximum price.");
  }
  return response.parsed_output;
}

// ---------------------------------------------------------------------------
// 2. Judging listings
// ---------------------------------------------------------------------------

export interface CandidateListing {
  assetId: string;
  name: string;
  subtitle: string;
  gradingCompany: string;
  grade: number | null;
  isBlackLabel: boolean;
  priceThb: number;
  vaulted: boolean;
  seller: { rating: number | null; reviewCount: number; idVerified: boolean; completedSales: number };
  market: {
    cardMartMedianSaleThb: number | null;
    cardMartSalesCount: number;
    lowestOtherListingThb: number | null;
    ebayMedianAskingThb: number | null;
  };
}

const Judgement = z.object({
  decisions: z.array(
    z.object({
      assetId: z.string(),
      isMatch: z.boolean().describe("Is this listing actually the card the user asked for (same card, grade rules met)?"),
      buy: z.boolean().describe("Recommend buying: a match, and a fair or good price given the market data"),
      fairValueThb: z.number().int().nullable().describe("Your estimate of a fair price for this exact card and grade, or null if there's no basis"),
      confidence: z.enum(["low", "medium", "high"]),
      reasoning: z.string().describe("One or two plain sentences for the buyer explaining the call, citing the numbers used"),
    }),
  ),
});
export type ListingJudgement = z.infer<typeof Judgement>["decisions"][number];

const JUDGE_SYSTEM = `You are a careful buying agent for a trading-card collector on CardMart, a Thai marketplace (prices in THB). For each candidate listing, decide:
1. isMatch — is it really the card the collector asked for? Watch for different sets, numbers, languages, promos, reprints or illustration variants with similar names. A grade above the minimum is fine.
2. buy — is it worth buying now? Compare the price with the market data given. Recommend buying when it's at or below a fair price; skip when it's clearly overpriced. With no market data at all, judge from the collector's own maximum and say so with low confidence.
Every candidate is already within the collector's price limit, so don't reject a listing only for being close to it.

Write reasoning for the collector, not for a developer: short, concrete, always in English, with amounts written as "20,000 THB" (never the ฿ sign).`;

export async function judgeListings(
  mandate: { instruction: string; summary: string; maxPriceThb: number },
  candidates: CandidateListing[],
): Promise<ListingJudgement[]> {
  if (candidates.length === 0) return [];
  const response = await anthropic().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    ...withFallback(),
    output_config: { effort: "medium", format: betaZodOutputFormat(Judgement) },
    system: JUDGE_SYSTEM,
    messages: [
      {
        role: "user",
        content: `The collector asked: "${mandate.instruction}"
Agent goal: ${mandate.summary}
Maximum per card: ${mandate.maxPriceThb.toLocaleString()} THB

Candidate listings (JSON):
${JSON.stringify(candidates, null, 2)}

Return one decision per candidate, using its assetId.`,
      },
    ],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) return [];
  const known = new Set(candidates.map((c) => c.assetId));
  return response.parsed_output.decisions.filter((d) => known.has(d.assetId));
}
