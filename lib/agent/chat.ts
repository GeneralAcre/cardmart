import "server-only";
// One turn of the agent chat, and the checks that keep it from making things
// up. The server action (agentChat in lib/agent-actions.ts) handles sign-in,
// limits and loading the user's data; this decides what to send the AI and
// what of its answer to trust.
//
// The rules:
//   - The AI only sees CardMart's real data for the cards being discussed. When
//     a message brings up another card (to hunt for, or just asked about), its
//     prices are looked up and it's asked again.
//   - Every money amount in its reply must come from the user or that data
//     (lib/agent/grounding.ts). If not, it's asked once more, and then a safe
//     fallback is shown instead of a made-up number.
//   - It can't set a max price or budget the user didn't say, or turn on
//     buying without approval unless the user asked for it.
//   - The task card only shows once the task can actually start.
import { chatWithAgent, MIN_CALL_MS, type ChatDraft, type ChatFacts, type ChatMessage } from "@/lib/agent/ai";
import { allowedAmounts, ungroundedAmounts, textsMention } from "@/lib/agent/grounding";
import { EMPTY_DRAFT, draftProblem, type TaskDraft } from "@/lib/agent/task";

export const SALE_LOOKBACK_DAYS = 90;

/** Real CardMart prices for the card being discussed, shown in the chat and given to the AI. */
export interface MarketSnapshot {
  query: string;
  forSale: number;
  lowestThb: number | null;
  medianAskThb: number | null;
  recentSales: number;
  medianSaleThb: number | null;
  cheapest: {
    id: string;
    name: string;
    subtitle: string;
    gradingCompany: string;
    grade: number | null;
    isBlackLabel: boolean;
    priceThb: number;
    imageUrl: string | null;
  }[];
}

export interface ChatTurn {
  reply: string;
  quickReplies: string[];
  // null = no task has come up yet.
  draft: TaskDraft | null;
  showTask: boolean;
  // Set when this message changed which card is being hunted for.
  market: MarketSnapshot | null;
}

// The page allows 60 seconds per request; leave room for loading data around the AI calls.
const TURN_BUDGET_MS = 45_000;

export async function runChatTurn(opts: {
  history: ChatMessage[];
  draft: TaskDraft | null;
  // What the AI knows about the user from CardMart: tasks, finds, alerts, wallet.
  known: string;
  // Market data for `draft`'s card, if there is one.
  market: MarketSnapshot | null;
  lookupMarket: (draft: TaskDraft) => Promise<MarketSnapshot | null>;
  locale: "en" | "th";
  facts: ChatFacts;
}): Promise<ChatTurn> {
  const { history, draft, known, locale, facts } = opts;
  const deadline = Date.now() + TURN_BUDGET_MS;
  const hasTime = () => deadline - Date.now() > MIN_CALL_MS;
  const userText = history.filter((m) => m.role === "user").map((m) => m.content);

  type Looked = { card: TaskDraft; market: MarketSnapshot | null };
  const contextFor = (d: TaskDraft | null, looked: Looked[]) =>
    [known, `Current task draft: ${d ? JSON.stringify(d) : "none yet"}`, ...looked.map((l) => describeMarket(l.card, l.market))].join("\n");
  const ask = async (context: string, looked: Looked[]) => {
    const res = await chatWithAgent({ history, context, locale, facts, deadline });
    const data = [known, ...looked.map((l) => marketAmounts(l.market))];
    const guarded = res.draft ? guardDraft(toDraft(res.draft), draft, userText, data) : { draft, fixes: [] };
    return { res, next: guarded.draft, fixes: guarded.fixes };
  };

  // Asking again is a refinement: if it fails or runs out of time, keep the answer already in hand.
  const askAgain = (context: string, l: Looked[]) =>
    ask(context, l).catch((err) => {
      console.warn("agent chat: asking again failed, keeping the first answer", err);
      return null;
    });

  let looked: Looked[] = draft && draft.query.trim().length >= 2 ? [{ card: draft, market: opts.market }] : [];
  let context = contextFor(draft, looked);
  let { res, next, fixes } = await ask(context, looked);

  // The AI only knew the prices of the draft's card. If this message brought
  // up another card — a new one to hunt for, or one the user's asking about —
  // look it up and ask again, so it talks about the right numbers (or knows
  // there are none).
  const lookups: TaskDraft[] = [];
  const changed = Boolean(next && next.query.trim().length >= 2 && (!draft || cardKey(next) !== cardKey(draft)));
  if (changed) lookups.push(next!);
  const asked = res.cardInQuestion ? toDraft({ ...EMPTY_DRAFT, ...res.cardInQuestion, maxPriceThb: null }) : null;
  if (asked && asked.query.trim().length >= 2 && !lookups.concat(next ?? []).some((c) => cardKey(c) === cardKey(asked))) {
    lookups.push(asked);
  }
  if (lookups.length && hasTime()) {
    const found = await Promise.all(lookups.map(async (card) => ({ card, market: await opts.lookupMarket(card).catch(() => null) })));
    looked = [...(changed ? [] : looked), ...found];
    context = contextFor(next, looked);
    ({ res, next, fixes } = (await askAgain(context, looked)) ?? { res, next, fixes });
  }

  // Every amount it writes must come from the user or from CardMart's data,
  // and it mustn't have set anything the user didn't ask for. If it did, tell
  // it what was wrong and ask once more (time allowing; what it set is put
  // back either way).
  const allowed = allowedAmounts(userText, [context], Object.values(facts), {
    buyerFeePercent: facts.buyerFeePercent,
    maxCards: next?.maxCards ?? 1,
  });
  // Only the reply is worth asking again for; a quick reply with a made-up amount is just dropped.
  const madeUp = (r: typeof res) => ungroundedAmounts(r.reply, allowed);
  let bad = madeUp(res);
  if ((bad.length || fixes.length) && hasTime()) {
    console.warn("agent chat: asking again", { amounts: bad, fixes });
    const problems = [
      bad.length
        ? `Your last answer used amounts that aren't in the data or from the user: ${bad.map((n) => `${n.toLocaleString()} THB`).join(", ")}. Don't use them. Only use amounts from the user or from what you know above; if there's no number for something, say so.`
        : null,
      ...fixes,
    ];
    const again = await askAgain(`${context}\n${problems.filter(Boolean).join("\n")}`, looked);
    if (again) {
      ({ res, next } = again);
      bad = madeUp(res);
    }
  }
  if (bad.length) console.warn("agent chat: amounts still not in the data, answering from the data", bad);

  // The newest card looked up is the one this message was about.
  const shown = lookups.length ? (looked.at(-1) ?? null) : null;
  return {
    // Still made up after a retry: say only what the data says rather than show a wrong number.
    // The chat shows plain text, so drop any markdown emphasis the model slips in.
    reply: (bad.length ? fromTheData(shown?.card ?? next, shown?.market ?? null, locale) : res.reply)
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .trim(),
    quickReplies: res.quickReplies
      .map((r) => r.trim())
      .filter((r) => r.length <= 40 && /^[\p{L}\p{N}]/u.test(r) && !CHAT_CANT_DO.test(r) && ungroundedAmounts(r, allowed).length === 0)
      .slice(0, 4),
    draft: next,
    showTask: Boolean(next && res.showTask && !draftProblem(next)),
    market: shown?.market ?? null,
  };
}

/** A reply built only from CardMart's data, for when the AI keeps getting a number wrong. */
function fromTheData(d: TaskDraft | null, m: MarketSnapshot | null, locale: "en" | "th"): string {
  const th = locale === "th";
  const ask = th ? "จ่ายได้สูงสุดเท่าไหร่ต่อใบครับ?" : "What's the most you'd pay for one?";
  if (!d || !m || (m.forSale === 0 && m.recentSales === 0)) {
    return th
      ? `ขอโทษครับ ตอนนี้ CardMart ยังไม่มีข้อมูลราคาของการ์ดใบนี้ ${ask}`
      : `Sorry, CardMart doesn't have price data for that card yet. ${ask}`;
  }
  const parts = [
    m.lowestThb != null
      ? th
        ? `มีลงขาย ${m.forSale} ใบ ราคาต่ำสุด ${m.lowestThb.toLocaleString()} THB`
        : `${m.forSale} for sale from ${m.lowestThb.toLocaleString()} THB`
      : null,
    m.medianSaleThb != null
      ? th
        ? `ขายไป ${m.recentSales} ใบใน ${SALE_LOOKBACK_DAYS} วันที่ผ่านมา ราคากลาง ${m.medianSaleThb.toLocaleString()} THB`
        : `${m.recentSales} sold in the last ${SALE_LOOKBACK_DAYS} days at a median of ${m.medianSaleThb.toLocaleString()} THB`
      : null,
  ].filter(Boolean);
  return th ? `บน CardMart ตอนนี้ ${parts.join(" และ ")} ${ask}` : `On CardMart right now: ${parts.join(", and ")}. ${ask}`;
}

// Grade words belong in the grade fields, not in the card name the agent searches for.
const GRADE_WORDS = /\b(?:PSA|BGS|CGC)\s*\d+(?:\.5)?\b|\bgem\s*mint\b|\bblack\s*label\b|\bgrade\s*\d+(?:\.5)?\b/gi;

function toDraft(d: ChatDraft): TaskDraft {
  const query = d.query.replace(GRADE_WORDS, " ").replace(/\s+/g, " ").trim();
  return {
    ...EMPTY_DRAFT,
    ...d,
    query: (query.length >= 2 ? query : d.query).slice(0, 120),
    minGrade: d.minGrade != null && d.minGrade >= 1 && d.minGrade <= 10 ? d.minGrade : null,
    maxPriceThb: Math.max(d.maxPriceThb ?? 0, 0),
    maxCards: Math.min(Math.max(d.maxCards, 1), 20),
    budgetThb: d.budgetThb && d.budgetThb > 0 ? d.budgetThb : null,
    notes: d.notes.slice(0, 300),
  };
}

/** CardMart's own prices for the card, as text the grounding check can read. */
const marketAmounts = (m: MarketSnapshot | null) =>
  m ? [m.lowestThb, m.medianAskThb, m.medianSaleThb, ...m.cheapest.map((c) => c.priceThb)].filter((n) => n != null).join(" ") : "";

// What the user has to ask for (in English or Thai) before the AI may switch it on.
const ASKED_FOR_AUTO_BUY = /auto|without asking|don'?t ask|no need to ask|buy it (right away|straight away|immediately)|just buy|อัตโนมัติ|ไม่ต้องถาม|ซื้อเลย/i;
const ASKED_FOR_SHIPPING = /ship|deliver|send it|mail|ส่ง/i;
const ASKED_FOR_OFFERS = /offer|negotiat|ข้อเสนอ|ต่อราคา/i;

// Quick replies for things only the buttons on the page can do; tapping one would go nowhere.
const CHAT_CANT_DO = /approve|decline|^(pause|resume|stop)\b|withdraw|อนุมัติ|ปฏิเสธ/i;

/**
 * Keeps the AI from setting what the user didn't ask for. A max price or
 * budget has to be one the user said, or one of CardMart's own numbers (when
 * they ask for "the lowest listing"). Buying without approval, shipping and
 * sending offers have to be things the user asked for. Anything else is put back, and `fixes`
 * says what, so the AI can be told. The user still checks the task card
 * before starting it.
 */
export function guardDraft(
  next: TaskDraft,
  prev: TaskDraft | null,
  userText: string[],
  // CardMart's own numbers the user can see: their tasks and finds, and the card's prices.
  data: string[],
): { draft: TaskDraft; fixes: string[] } {
  const fixes: string[] = [];
  const sources = [...userText, ...data];
  const real = (n: number) => textsMention(n, sources);

  const prevMax = prev?.maxPriceThb ?? 0;
  let maxPriceThb = next.maxPriceThb;
  if (maxPriceThb !== prevMax && maxPriceThb !== 0 && !real(maxPriceThb)) {
    fixes.push(
      `You set the max price to ${maxPriceThb.toLocaleString()} THB, but the user never said that, so it stays ${prevMax ? `${prevMax.toLocaleString()} THB` : "not set"}. Ask them instead.`,
    );
    maxPriceThb = prevMax;
  }
  let budgetThb = next.budgetThb;
  if (budgetThb != null && budgetThb !== prev?.budgetThb && !real(budgetThb)) {
    fixes.push(`You set the total budget to ${budgetThb.toLocaleString()} THB, but the user never said that, so it isn't set.`);
    budgetThb = prev?.budgetThb ?? null;
  }
  let autoBuy = next.autoBuy;
  if (autoBuy && !prev?.autoBuy && !userText.some((t) => ASKED_FOR_AUTO_BUY.test(t))) {
    fixes.push("You turned on buying automatically, but the user didn't ask for it, so it stays off (the agent asks first).");
    autoBuy = false;
  }
  const asked = (re: RegExp) => userText.some((t) => re.test(t));
  let fulfillment = next.fulfillment;
  if (fulfillment === "SHIP" && prev?.fulfillment !== "SHIP" && !asked(ASKED_FOR_SHIPPING)) {
    fixes.push("You switched to shipping the card, but the user didn't ask for it, so it stays in the vault.");
    fulfillment = "VAULT";
  }
  let makeOffers = next.makeOffers;
  if (makeOffers && !prev?.makeOffers && !asked(ASKED_FOR_OFFERS)) {
    fixes.push("You turned on sending offers, but the user didn't ask for it, so it stays off.");
    makeOffers = false;
  }
  return {
    draft: {
      ...next,
      maxPriceThb,
      autoBuy,
      fulfillment,
      makeOffers,
      // A budget of exactly max × cards is the default anyway.
      budgetThb: budgetThb === maxPriceThb * next.maxCards ? null : budgetThb,
    },
    fixes,
  };
}

/** What decides which listings match — when it changes, the market data has to be looked up again. */
const cardKey = (d: TaskDraft) =>
  [d.query.trim().toLowerCase(), d.game, d.gradingCompanies.join(), d.minGrade, d.blackLabelOnly].join("|");

function describeMarket(d: TaskDraft, m: MarketSnapshot | null): string {
  if (!m) return `CardMart market data for "${d.query}": not available right now, so you don't know its prices. Don't mention any.`;
  if (m.forSale === 0 && m.recentSales === 0) {
    return `CardMart market for "${m.query}" with the draft's grade filters: nothing for sale and no sales in the last ${SALE_LOOKBACK_DAYS} days, so there's no CardMart price for it.`;
  }
  return `CardMart market for "${m.query}" with the draft's grade filters: ${m.forSale} for sale now${
    m.lowestThb != null ? `, lowest ${m.lowestThb.toLocaleString()} THB, median asking ${m.medianAskThb!.toLocaleString()} THB` : ""
  }; ${m.recentSales} sale(s) in the last ${SALE_LOOKBACK_DAYS} days${
    m.medianSaleThb != null ? `, median ${m.medianSaleThb.toLocaleString()} THB` : ""
  }. The user can see these numbers.`;
}
