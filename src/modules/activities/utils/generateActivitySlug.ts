const MAX_SLUG_LENGTH = 150;

export function generateActivitySlug(
  name: string,
  suffix?: number,
): string {
  const baseSlug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const normalizedBase = baseSlug || "atividade";

  if (suffix === undefined) {
    return normalizedBase.slice(0, MAX_SLUG_LENGTH);
  }

  const suffixText = `-${suffix}`;
  const availableLength = MAX_SLUG_LENGTH - suffixText.length;

  return `${normalizedBase.slice(0, availableLength)}${suffixText}`;
}