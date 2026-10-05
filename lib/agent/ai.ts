import "server-only";
// The AI's two jobs in the buying agent:
//   1. chatWithAgent — talk with the collector, answer their questions, and
//      turn "find me a PSA 10 Charizard under 20k" into a task draft with
//      search criteria and limits that the user then reviews and starts.
//   2. judgeListings — for listings that already pass the hard filters, decide
//      whether each one is really the card the user asked for and a fair
//      price, with a short reason the user can read.
// The AI never sets or overrides a limit: the user starts every task
// themselves, and every price/budget/count check runs in code before and
// after it (see lib/agent/engine.ts).
//
// Both go through OpenRouter (https://openrouter.ai), so the model is just an
// env var. Chatting is light work and runs on the cheapest model; judging
// needs real judgement about card variants and prices.
import { z } from "zod";

const CHAT_MODEL = process.env.OPENROUTER_PLAN_MODEL || "deepseek/deepseek-v4-flash";
const JUDGE_MODEL = process.env.OPENROUTER_JUDGE_MODEL || "deepseek/deepseek-v4-pro";

export function isAgentAiConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

type CompletionMessage = { role: "system" | "user" | "assistant"; content: string };

/**
 * One chat completion that must return JSON matching `schema`. Returns null
 * if the model refused, got cut off, or returned something that doesn't fit.
 */
async function completeJson<T extends z.ZodType>(opts: {
  model: string;
  maxTokens: number;
  messages: CompletionMessage[];
  name: string;
  schema: T;
  // Abort the request after this long.
  timeoutMs?: number;
}): Promise<z.infer<T> | null> {
  const jsonSchema = z.toJSONSchema(opts.schema, { target: "draft-7" });
  delete jsonSchema.$schema;
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: opts.timeoutMs != null ? AbortSignal.timeout(Math.max(opts.timeoutMs, 1)) : undefined,
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "X-Title": "CardMart buying agent",
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens,
      messages: opts.messages,
      response_format: { type: "json_schema", json_schema: { name: opts.name, strict: true, schema: jsonSchema } },
      // Only route to providers that actually enforce the JSON schema.
      provider: { require_parameters: true },
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const data = await res.json();
  const choice = data.choices?.[0];
  if (!choice || choice.finish_reason !== "stop" || typeof choice.message?.content !== "string") return null;
  try {
    const parsed = opts.schema.safeParse(JSON.parse(choice.message.content));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 1. Chatting with the collector
// ---------------------------------------------------------------------------

const GRADERS = ["PSA", "BGS", "CGC", "RAW"] as const;

const ChatDraft = z.object({
  query: z
    .string()
    .describe("The card name as a seller would title the listing, without grade or price words; empty until the user names a card"),
  game: z.enum(["POKEMON", "ONE_PIECE"]).nullable(),
  gradingCompanies: z.array(z.enum(GRADERS)).describe("Empty means any grader, including raw cards"),
  minGrade: z.number().nullable(),
  blackLabelOnly: z.boolean(),
  maxPriceThb: z
    .number()
    .int()
    .nullable()
    .describe("Most the user will pay for one card, in THB — only a number the user gave or agreed to"),
  budgetThb: z.number().int().nullable().describe("Total the agent may spend across all cards; null to follow max price × cards"),
  maxCards: z.number().int().describe("How many cards to buy in total; 1 unless the user asks for more"),
  trustedSellersOnly: z.boolean(),
  autoBuy: z.boolean().describe("true only if the user wants it to buy without asking first"),
  makeOffers: z.boolean().describe("true if the user wants offers sent on listings priced a little above the max"),
  fulfillment: z.enum(["VAULT", "SHIP"]).describe("VAULT keeps the card in CardMart's vault; SHIP mails it to the user"),
  notes: z.string().describe("Other requirements in English, e.g. 'English cards only, no 1st Edition'; empty if none"),
});
export type ChatDraft = z.infer<typeof ChatDraft>;

const ChatReply = z.object({
  reply: z.string().describe("What you say back: friendly, 1–3 short sentences, in the user's language"),
  quickReplies: z
    .array(z.string())
    .describe("2–4 short answers the user can tap to send, written as the user would say them, in the user's language"),
  draft: ChatDraft.nullable().describe("The buying task as it stands after this message, or null if no task has come up yet"),
  showTask: z
    .boolean()
    .describe("true when the draft has a card and a max price and it's time for the user to review and start it"),
  cardInQuestion: z
    .object({
      query: z.string().describe("The card name, without grade or price words"),
      game: z.enum(["POKEMON", "ONE_PIECE"]).nullable(),
      gradingCompanies: z.array(z.enum(GRADERS)),
      minGrade: z.number().nullable(),
    })
    .nullable()
    .describe(
      "A card the user asks about in their latest message (its price, what's for sale, whether to buy) that isn't the draft's card, so CardMart's data for it can be looked up; null otherwise",
    ),
});
export type ChatReply = z.infer<typeof ChatReply>;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const CHAT_SYSTEM = `You are the buying agent on CardMart, a Thai marketplace for graded and raw Pokémon and One Piece trading cards. You chat with a collector to help them. The main thing you do is set up buying tasks: once the user starts one, you watch every new listing and buy the right card for them, within their limits.

What a task can do: find Pokémon and One Piece cards, raw or graded (PSA, BGS, CGC); check every new listing, day and night; skip look-alikes from other sets; compare prices with recent CardMart sales and eBay; ask the user first or buy on its own; send an offer when a listing is priced a little above the max (the offer is never more than the max); pay through escrow like any purchase, then keep the card in the vault or ship it.
What it won't do: pay over the max price; spend more than the agent wallet holds; join auctions or trades; sell cards. Up to 5 tasks at once. Starting a task costs {fee} THB from the agent wallet, which is funded with SOL (1 SOL ≈ {thbPerSol} THB). Buyers pay a {buyerFee}% fee on purchases.

How CardMart works (keep in step with the Guide page, app/(app)/guide/page.tsx):
- Every account has a Solana wallet; on Portfolio, Deposit adds test SOL (devnet). Prices are in THB.
- Payments are locked in an on-chain escrow, not paid straight to the seller. They're released only after CardMart's warehouse inspects the card and confirms it matches its certificate; otherwise the buyer is refunded.
- A bought card can be shipped to the buyer or kept in CardMart's vault. Vaulted cards can be resold, auctioned or swapped instantly with no shipping, and redeemed to the owner's door any time.
- Item pages show Price Insights: CardMart's median sale, other listings of the same card, eBay, TCGplayer, Beckett and PriceCharting.
- Buyers can make offers below the asking price; if the seller accepts, they check out at that price.
- Auctions: a bid is locked in escrow when placed and returned automatically if outbid. Minimum bids go up in 50 THB steps, and a bid in the last 5 minutes adds 5 more minutes.
- Swaps: trade a vaulted card for someone else's vaulted card, with cash on top either way, held in escrow until the swap completes.
- Card alerts (Portfolio → Alerts): name, grade and max price, optionally trusted sellers only; the user is notified when one is listed.
- Selling: Listing uses a live-camera checklist and fills details from a PSA cert number. Listing costs {listingFee} THB. Each card becomes a 1-of-1 token on Solana. Fixed price or auction (scheduled up to 30 days ahead). When it sells, the seller ships it to the warehouse ({sellerShipping} THB shipping); vaulted cards sell instantly.
- Trust: ID verification gives a badge; completed sales can earn buyer reviews and a rating.

Where things are (the user is on the Agent page, chatting with you):
- On this page: the agent wallet card next to the chat (balance, Add funds, Withdraw all); finds "Waiting for your OK", with "Approve & buy" and "Decline" buttons; their tasks, each with Pause (or Resume) and Stop; and the agent's activity with its reasons.
- Elsewhere: Market (browse and buy), Portfolio (their cards, wallet Deposit, Alerts, ID verification), Auctions, and the Guide in the menu under their avatar.
- For anywhere else in the app, don't describe where things are — say you're not sure. There's no support contact listed here, so don't promise one.

What you can't do from the chat: approve or decline a find, buy a card, make an offer, pause or stop a task, or move money. Tell the user which button on this page does it. Never offer a quick reply for those.

Being honest — this matters most:
- Only state facts about CardMart that are written above, and only numbers from above, from "What you know right now", or from the user. If you don't know something (a refund timeline, delivery times, a card's details or value), say you're not sure and point to where they can check — the item page's Price Insights, or the Guide in the menu under their avatar.
- Never invent a price, a sales figure, a listing, a trend or how popular a card is. Suggest prices only from the market data you're given, and say where they come from ("the lowest listing on CardMart is …"). With no data, say there's no CardMart data for that card yet and ask what they'd pay.
- Don't tell the user what their tasks, wallet or alerts hold unless it's in "What you know right now".
- Don't guess card details the user didn't give (set names, card numbers, print runs). If the card is ambiguous, ask.

How to talk:
- Be brief and warm, like a helpful shop assistant. Ask one question at a time. Plain text only — no markdown, bold or bullet lists.
- Always give quickReplies for what you just asked, so the user can tap instead of typing — e.g. grades ("PSA 10", "PSA 9 or better", "Any grade"), prices taken from the market data ("27,500 THB"), "Ask me first", "Buy it automatically". Each one is 1–5 words, with no explanation in brackets. With no question pending, suggest useful next steps.
- Start the draft as soon as the user names a card they want to buy, filling in everything they've said so far. Questions about their existing tasks or finds aren't a new task — leave the draft as it is.
- To set up a task you need the card and a max price per card. Ask about the grade if it's unclear. Then show the task (showTask true) with sensible defaults for everything else. The user sees the task on a card under your message, so don't list its details — just say it's ready and that they can change anything by telling you.
- Never offer a quick reply to start the task: the card has the "Start agent" button.
- Read "k" as thousands (20k = 20000). Grades run 1–10 (BGS has half grades); "gem mint" means 10.
- Carry the draft forward every turn and change only what the user asked for. Leave autoBuy false (ask first) unless the user asks for it to buy without asking.
- You can't start a task yourself — the user taps "Start agent" on the task card. Never say a task has started.
- Answer general questions about CardMart and card collecting, then steer back to how you can help. Politely decline anything unrelated.
- Reply in the language the user writes in (Thai or English); when a message doesn't show it (like "30k"), use {language}. Write amounts as "20,000 THB", never with the ฿ sign.`;

/** Platform numbers the chat's system prompt quotes. */
export interface ChatFacts {
  feeThb: number;
  thbPerSol: number;
  buyerFeePercent: number;
  listingFeeThb: number;
  sellerShippingThb: number;
}

export async function chatWithAgent(opts: {
  history: ChatMessage[];
  // What the agent knows right now: the user's tasks, alerts, the current draft and market data.
  context: string;
  // The language the site is shown in.
  locale: "en" | "th";
  facts: ChatFacts;
  // Give up by this time (epoch ms), so a slow model can't run past the request's time limit.
  deadline: number;
}): Promise<ChatReply> {
  const system = CHAT_SYSTEM.replace("{fee}", String(opts.facts.feeThb))
    .replace("{thbPerSol}", opts.facts.thbPerSol.toLocaleString())
    .replace("{buyerFee}", String(opts.facts.buyerFeePercent))
    .replace("{listingFee}", String(opts.facts.listingFeeThb))
    .replace("{sellerShipping}", String(opts.facts.sellerShippingThb))
    .replace("{language}", opts.locale === "th" ? "Thai" : "English");
  const ask = async () => {
    const reply = await completeJson({
      model: CHAT_MODEL,
      maxTokens: 4000,
      messages: [{ role: "system", content: `${system}\n\n${opts.context}` }, ...opts.history],
      name: "agent_reply",
      schema: ChatReply,
      timeoutMs: opts.deadline - Date.now(),
    });
    // An empty reply fits the schema but says nothing; count it as a miss.
    return reply?.reply.trim() ? reply : null;
  };
  // The model now and then returns JSON that doesn't fit; one retry is usually enough, if there's time.
  let reply = await ask();
  if (!reply && opts.deadline - Date.now() > MIN_CALL_MS) reply = await ask();
  if (!reply) throw new Error("The agent lost its train of thought. Try saying that again.");
  return reply;
}

/** Not worth starting a chat call with less time than this left. */
export const MIN_CALL_MS = 8_000;

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
  // Priced over the collector's maximum — the agent can only make an offer.
  askingAboveMax: boolean;
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
Candidates without askingAboveMax are already within the collector's price limit, so don't reject one only for being close to it. Candidates with askingAboveMax are priced a little above it: the agent can only offer the seller the collector's maximum or less, so set buy to true when it's the right card and worth that offer, and give a fairValueThb whenever there's any basis for one.

Write reasoning for the collector, not for a developer: short, concrete, always in English, with amounts written as "20,000 THB" (never the ฿ sign).`;

export async function judgeListings(
  mandate: { instruction: string; summary: string; maxPriceThb: number },
  candidates: CandidateListing[],
): Promise<ListingJudgement[]> {
  if (candidates.length === 0) return [];
  const result = await completeJson({
    model: JUDGE_MODEL,
    maxTokens: 16000,
    messages: [
      { role: "system", content: JUDGE_SYSTEM },
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
    name: "listing_judgement",
    schema: Judgement,
  });
  if (!result) return [];
  const known = new Set(candidates.map((c) => c.assetId));
  return result.decisions.filter((d) => known.has(d.assetId));
}
