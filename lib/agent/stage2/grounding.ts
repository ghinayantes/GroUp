const NUMBER = /(Rp\s?)?(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)/gi;
const SMALL_NUMBER_LIMIT = 31;
export const MONTHS = ["januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus", "september", "oktober", "november", "desember"];
const MONTH_NAME = new RegExp(String.raw`\b(${MONTHS.join("|")})\b`, "gi");
const ISO_DATE = /\b\d{4}-(\d{2})-\d{2}(T[\d:.]+Z)?/g;
const JAKARTA_MONTH = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", month: "numeric" });

type Mention = { value: number; currency: boolean };

function mentions(text: string): Mention[] {
  return [...text.matchAll(NUMBER)].map(([, currency, raw]) => {
    const value = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw) ? Number(raw.replaceAll(".", "").replace(",", ".")) : Number(raw.replace(",", "."));
    return { value, currency: Boolean(currency) };
  });
}

export function extractNumbers(text: string): number[] {
  return mentions(text).map((mention) => mention.value);
}

function monthNames(text: string): string[] {
  return [...text.matchAll(MONTH_NAME)].map(([name]) => name.toLowerCase());
}

function knownMonths(text: string): Set<string> {
  const months = new Set(monthNames(text));
  for (const [iso, month, time] of text.matchAll(ISO_DATE)) {
    months.add(MONTHS[Number(month) - 1]);
    if (time) months.add(MONTHS[Number(JAKARTA_MONTH.format(new Date(iso))) - 1]);
  }
  return months;
}

export function isGrounded(answer: string, toolOutputs: unknown[]): boolean {
  const serialized = toolOutputs.map((output) => JSON.stringify(output) ?? "").join(" ");
  const known = new Set(extractNumbers(serialized));
  const numbersOk = mentions(answer).every((mention) => known.has(mention.value) || (!mention.currency && mention.value <= SMALL_NUMBER_LIMIT));
  const months = knownMonths(serialized);
  return numbersOk && monthNames(answer).every((month) => months.has(month));
}
