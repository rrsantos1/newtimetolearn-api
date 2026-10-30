export interface NormalizedCrosswordAnswer {
  readonly original: string;
  readonly normalized: string;
}

export function normalizeCrosswordAnswer(
  input: string,
): NormalizedCrosswordAnswer {
  const original = input.trim();
  const normalized = original
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .replace(/[\\s-]/g, "")
    .toLocaleUpperCase("pt-BR");

  return { original, normalized };
}
