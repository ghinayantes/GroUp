const NUMBER = /(Rp\s?)?(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)/gi;
const SMALL_NUMBER_LIMIT = 31;

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

export function isGrounded(answer: string, toolOutputs: unknown[]): boolean {
  const known = new Set(toolOutputs.flatMap((output) => extractNumbers(JSON.stringify(output) ?? "")));
  return mentions(answer).every((mention) => known.has(mention.value) || (!mention.currency && mention.value <= SMALL_NUMBER_LIMIT));
}
