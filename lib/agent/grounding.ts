// Keeps the agent chat honest about money. Every amount the AI writes has to
// come from somewhere real: the user's own messages, CardMart's market data,
// the user's tasks and wallet, or the platform's fees. Anything else is a
// made-up number, and the chat retries or falls back rather than show it.
//
// Amounts under 100 are ignored: grades, card counts and percentages aren't
// prices, and every price on CardMart is at least 100 THB.
const MIN_AMOUNT = 100;

const THAI_DIGIT: Record<string, number> = {
  หนึ่ง: 1,
  สอง: 2,
  สาม: 3,
  สี่: 4,
  ห้า: 5,
  หก: 6,
  เจ็ด: 7,
  แปด: 8,
  เก้า: 9,
};
const UNIT: Record<string, number> = { k: 1_000, K: 1_000, พัน: 1_000, หมื่น: 10_000, แสน: 100_000 };
const THAI_PART = "(?:หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า)(?:แสน|หมื่น|พัน)";

/**
 * Amounts (≥ 100) written in the text: "20,000", "20k", "2.5k", "2 หมื่น",
 * "สองหมื่นห้าพัน". `strict` counts only numbers that read as money — with a
 * currency or "k"/Thai unit, or comma-grouped — so the AI mentioning set 151
 * or card 199/165 isn't taken for a price. Users' own messages are read
 * loosely, since "max 5000" is a price.
 */
export function amountsIn(text: string, strict = false): number[] {
  const found: number[] = [];
  const number = /(฿\s*)?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k|K|พัน|หมื่น|แสน)?(?![\d,.]*\d)(\s*(?:THB|baht|บาท))?/gi;
  for (const m of text.matchAll(number)) {
    const [, baht, digits, unit, currency] = m;
    if (strict && !baht && !unit && !currency && !digits.includes(",")) continue;
    found.push(Math.round(Number(digits.replace(/,/g, "")) * (unit ? UNIT[unit] : 1)));
  }
  for (const m of text.matchAll(new RegExp(`(?:${THAI_PART})+`, "g"))) {
    let sum = 0;
    for (const part of m[0].matchAll(/(หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า)(แสน|หมื่น|พัน)/g)) {
      sum += THAI_DIGIT[part[1]] * UNIT[part[2]];
    }
    found.push(sum);
  }
  return found.filter((n) => n >= MIN_AMOUNT);
}

/**
 * The amounts the AI may use: those in `userText` (read loosely) and
 * `dataText` (CardMart's own numbers), plus `extras`, plus the few it can
 * fairly work out from them — a total for several cards, and the buyer fee on
 * top of a price.
 */
export function allowedAmounts(
  userText: string[],
  dataText: string[],
  extras: number[],
  opts: { buyerFeePercent: number; maxCards: number },
): AllowedAmounts {
  const given = new Set([
    ...userText.flatMap((t) => amountsIn(t)),
    ...dataText.flatMap((t) => amountsIn(t)),
    ...extras.filter((n) => n >= MIN_AMOUNT),
  ]);
  const workedOut = new Set<number>();
  for (const a of given) {
    for (let n = 2; n <= Math.max(opts.maxCards, 2); n++) workedOut.add(a * n);
    const fee = Math.round((a * opts.buyerFeePercent) / 100);
    workedOut.add(fee);
    workedOut.add(a + fee);
  }
  return { given, workedOut };
}

export interface AllowedAmounts {
  // Amounts from the user or the data; "about 26,000" for 25,900 is fine.
  given: Set<number>;
  // Worked out from those; these have to be exact, or a made-up round number
  // could slip through next to one of them.
  workedOut: Set<number>;
}

/** Money amounts in `text` that aren't allowed. */
export function ungroundedAmounts(text: string, allowed: AllowedAmounts): number[] {
  const given = [...allowed.given];
  return amountsIn(text, true).filter(
    (n) => !allowed.workedOut.has(n) && !given.some((a) => Math.abs(a - n) <= a * 0.01),
  );
}

/** Whether any of the texts (read loosely) mentions this amount. */
export function textsMention(amount: number, texts: string[]): boolean {
  return texts.some((t) => amountsIn(t).includes(amount));
}
