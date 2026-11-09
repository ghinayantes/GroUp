const ABBREVIATIONS: Record<string, string> = {
  yang: "yg",
  tidak: "gak",
  sudah: "udah",
  kakak: "kak",
  dengan: "dgn",
  saja: "aja",
  berapa: "brp",
};

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function swapAdjacent(text: string, rng: () => number) {
  const positions = [...text].flatMap((char, i, chars) =>
    i + 1 < chars.length && /\p{L}/u.test(char) && /\p{L}/u.test(chars[i + 1]) && char !== chars[i + 1] ? [i] : [],
  );
  if (!positions.length) return text;
  const chars = [...text];
  const i = positions[Math.floor(rng() * positions.length)];
  [chars[i], chars[i + 1]] = [chars[i + 1], chars[i]];
  return chars.join("");
}

const abbreviate = (text: string) => text.replace(/\p{L}+/gu, (word) => ABBREVIATIONS[word.toLowerCase()] ?? word);

const casual = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

const stretchLastLetter = (text: string) => text.replace(/(\p{L})(\P{L}*)$/u, "$1$1$2");

export function augment(text: string, rng: () => number): string[] {
  const variants: string[] = [];
  const add = (candidate: string) => {
    if (candidate && candidate !== text && !variants.includes(candidate)) variants.push(candidate);
    return variants.includes(candidate) && candidate !== text;
  };
  add(swapAdjacent(text, rng));
  if (!add(abbreviate(text))) add(swapAdjacent(text, rng));
  if (!add(casual(text))) add(stretchLastLetter(text));
  return variants;
}
