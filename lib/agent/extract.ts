import type { Batch } from "@/lib/batch";
import type { ManagedOrder } from "@/lib/orders";
import { shortCode } from "./copy";

export type QuantityMention = { value: number; unit: string | null };

export type ExtractedSlots = { batches: Batch[]; quantity: QuantityMention | null; order: ManagedOrder | null; relative: boolean };

export const ALIASES: Record<string, string> = {
  cabe: "cabai",
  bawmer: "bawang merah",
  baput: "bawang putih",
  terigu: "tepung terigu",
  minyak: "minyak goreng",
  telor: "telur",
  gula: "gula pasir",
};

const UNITS: Record<string, string> = {
  kg: "kg",
  kgs: "kg",
  kilo: "kg",
  kilogram: "kg",
  gram: "gram",
  gr: "gram",
  g: "gram",
  ons: "ons",
  liter: "liter",
  ltr: "liter",
  l: "liter",
  sak: "sak",
  karung: "karung",
  pack: "pack",
  pak: "pack",
  ikat: "ikat",
  ton: "ton",
  kwintal: "kwintal",
  kuintal: "kwintal",
  ml: "ml",
};

// Satuan yang dikenali supaya tidak dianggap angka tanpa satuan, tapi tidak pernah dikonversi diam-diam.
const OTHER_UNITS = ["dus", "kardus", "karton", "box", "kotak", "krat", "peti", "bal", "lusin", "kodi", "biji", "buah", "butir", "pcs", "botol", "jerigen", "galon", "bungkus", "renteng", "rim"];
for (const unit of OTHER_UNITS) UNITS[unit] = unit;

const NUMBER_WORDS: Record<string, number> = {
  satu: 1,
  dua: 2,
  tiga: 3,
  empat: 4,
  lima: 5,
  enam: 6,
  tujuh: 7,
  delapan: 8,
  sembilan: 9,
  sepuluh: 10,
  setengah: 0.5,
  seperempat: 0.25,
};

const TO_BATCH_UNIT: Record<string, Record<string, number>> = {
  kg: { gram: 0.001, ons: 0.1, kwintal: 100, ton: 1000 },
  liter: { ml: 0.001 },
};

const FUZZY_MAX_DISTANCE = 0.25;
const FUZZY_MIN_LENGTH = 4;
const ORDER_CODE = /(?<![\p{L}\d])[0-9a-z]{6}(?![\p{L}\d])/giu;
const RELATIVE = /(?<!\p{L})(n?tambah\p{L}*|kurang\p{L}*|lagi|lg)(?!\p{L})/iu;

const unitPattern = Object.keys(UNITS).sort((a, b) => b.length - a.length).join("|");
const NUMERIC = new RegExp(
  String.raw`(?<![\p{L}\d.,/])(\d+\/\d+|\d{1,3}(?:\.\d{3})+(?![\d,])|\d+(?:[.,]\d+)?)\s*(${unitPattern})?(?![\p{L}\d])`,
  "giu",
);
const WORD = new RegExp(String.raw`(?<!\p{L})(${Object.keys(NUMBER_WORDS).join("|")})(?:\s+(${unitPattern}))?(?!\p{L})`, "giu");
const SE_UNIT = new RegExp(String.raw`(?<!\p{L})se(${unitPattern})(?!\p{L})`, "giu");

const normalizeSpaces = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();

function parseNumber(raw: string): number {
  if (raw.includes("/")) {
    const [a, b] = raw.split("/").map(Number);
    return b ? a / b : Number.NaN;
  }
  if (/^\d{1,3}(\.\d{3})+$/.test(raw)) return Number(raw.replaceAll(".", ""));
  return Number(raw.replace(",", "."));
}

const unitOf = (raw: string | undefined) => (raw ? UNITS[raw.toLowerCase()] : null);

export function parseQuantity(text: string): QuantityMention | null {
  const candidates: { index: number; mention: QuantityMention }[] = [];
  for (const match of text.matchAll(NUMERIC)) {
    const value = parseNumber(match[1]);
    if (Number.isFinite(value)) candidates.push({ index: match.index, mention: { value, unit: unitOf(match[2]) } });
  }
  for (const match of text.matchAll(WORD)) candidates.push({ index: match.index, mention: { value: NUMBER_WORDS[match[1].toLowerCase()], unit: unitOf(match[2]) } });
  for (const match of text.matchAll(SE_UNIT)) candidates.push({ index: match.index, mention: { value: 1, unit: unitOf(match[1]) } });
  candidates.sort((a, b) => a.index - b.index);

  const withUnit = candidates.find((c) => c.mention.unit !== null);
  if (withUnit) return withUnit.mention;
  const values = new Set(candidates.map((c) => c.mention.value));
  return values.size === 1 ? candidates[0].mention : null;
}

export function toBatchUnit(quantity: QuantityMention, batchUnit: string): number | null {
  const target = unitOf(batchUnit) ?? batchUnit.toLowerCase();
  if (quantity.unit === null || quantity.unit === target) return quantity.value;
  const factor = TO_BATCH_UNIT[target]?.[quantity.unit];
  return factor === undefined ? null : Number((quantity.value * factor).toFixed(3));
}

export function normalizedDistance(a: string, b: string): number {
  const x = normalizeSpaces(a);
  const y = normalizeSpaces(b);
  const longest = Math.max(x.length, y.length);
  if (longest === 0) return 0;
  let previous = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const current = [i];
    for (let j = 1; j <= y.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[y.length] / longest;
}

const words = (text: string) => normalizeSpaces(text).match(/\p{L}+/gu) ?? [];

function expandAliases(text: string) {
  return words(text).flatMap((word) => (ALIASES[word] ?? word).split(" "));
}

/** Nama bahan dengan alias dibuka, huruf kecil, tanpa kata berulang: "cabe keriting" → "cabai keriting", "tepung terigu" tetap. */
export const normalizeMaterial = (text: string) => [...new Set(expandAliases(text))].join(" ");

const withBigrams = (tokens: string[]) => [...tokens, ...tokens.slice(1).map((token, i) => tokens[i] + token)];

const tokenMatches = (a: string, b: string) =>
  a === b || (Math.min(a.length, b.length) >= FUZZY_MIN_LENGTH && normalizedDistance(a, b) <= FUZZY_MAX_DISTANCE);

function matchByName<T>(text: string, items: T[], nameOf: (item: T) => string): T[] {
  const message = withBigrams(expandAliases(text));
  const nameTokens = items.map((item) => withBigrams(words(nameOf(item))));
  const owners = new Map<string, number>();
  for (const tokens of nameTokens) for (const token of new Set(tokens)) owners.set(token, (owners.get(token) ?? 0) + 1);

  const hits = nameTokens.map((tokens) => {
    const matched = tokens.filter((token) => message.some((word) => tokenMatches(word, token)));
    return { any: matched.length > 0, distinctive: matched.some((token) => owners.get(token) === 1) };
  });
  const distinctive = items.filter((_, i) => hits[i].distinctive);
  return distinctive.length ? distinctive : items.filter((_, i) => hits[i].any);
}

export function nameMatchScore(text: string, name: string): number {
  const message = expandAliases(text);
  const tokens = words(name);
  if (!tokens.length) return 0;
  return tokens.filter((token) => message.some((word) => tokenMatches(word, token))).length / tokens.length;
}

export function matchBatches(text: string, batches: Batch[]): Batch[] {
  return matchByName(
    text,
    batches.filter((batch) => batch.acceptingOrders),
    (batch) => batch.name,
  );
}

function explicitCodes(text: string) {
  return (text.match(ORDER_CODE) ?? []).map((code) => code.toUpperCase());
}

export function matchOrder(text: string, orders: ManagedOrder[]): ManagedOrder | null {
  const editable = orders.filter((order) => order.editable && order.status === "confirmed");
  const codes = explicitCodes(text);
  const byCode = editable.find((order) => codes.includes(shortCode(order.id)));
  if (byCode) return byCode;
  if (codes.some((code) => /\d/.test(code))) return null;

  const matched = matchByName(text, editable, (order) => order.batch.name);
  return matched.length === 1 ? matched[0] : null;
}

export function extractSlots(text: string, ctx: { batches: Batch[]; orders: ManagedOrder[] }): ExtractedSlots {
  const order = matchOrder(text, ctx.orders);
  const withoutCode = order ? text.replace(new RegExp(shortCode(order.id), "i"), " ") : text;
  return { batches: matchBatches(text, ctx.batches), quantity: parseQuantity(withoutCode), order, relative: RELATIVE.test(text) };
}
