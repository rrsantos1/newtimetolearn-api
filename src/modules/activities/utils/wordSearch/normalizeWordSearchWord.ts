export interface NormalizedWordSearchWord {
  original: string;
  normalized: string;
  letters: string[];
}

export function normalizeWordSearchWord(
  input: string,
): NormalizedWordSearchWord {
  const original = input.trim();

  const normalized = original
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]/g, "")
    .toUpperCase();

  return {
    original,
    normalized,
    letters: Array.from(normalized),
  };
}