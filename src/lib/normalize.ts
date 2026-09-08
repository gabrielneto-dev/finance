const COMBINING_DIACRITICS = new RegExp(
  `[\\u0300-\\u036f]`,
  "g",
);

export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .toLowerCase()
    .trim();
}
