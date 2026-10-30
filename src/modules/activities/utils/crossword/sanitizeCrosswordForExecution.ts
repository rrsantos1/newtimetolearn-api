export interface SafeCrosswordClue {
  readonly number: number;
  readonly clue: string;
  readonly direction: "across" | "down";
  readonly row: number;
  readonly col: number;
  readonly length: number;
}

export interface SafeCrosswordGeneratedData extends Record<string, unknown> {
  readonly grid: (string | null)[][];
  readonly clues: readonly SafeCrosswordClue[];
}

interface RawCrosswordClue {
  readonly number: number;
  readonly clue: string;
  readonly direction: "across" | "down";
  readonly row: number;
  readonly col: number;
  readonly word: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeAnswer(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]/g, "")
    .toLocaleUpperCase("pt-BR");
}

function isRawClue(value: unknown): value is RawCrosswordClue {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Number.isInteger(value.number) &&
    typeof value.clue === "string" &&
    (value.direction === "across" || value.direction === "down") &&
    Number.isInteger(value.row) &&
    Number.isInteger(value.col) &&
    typeof value.word === "string" &&
    normalizeAnswer(value.word).length > 0
  );
}

/**
 * Removes the answer key from crossword data before it is sent to a non-owner.
 * A null grid cell is blocked; an empty string is a playable cell.
 */
export function sanitizeCrosswordForExecution(
  content: Record<string, unknown>,
  generatedData: Record<string, unknown> | null,
): {
  readonly content: Record<string, unknown>;
  readonly generatedData: SafeCrosswordGeneratedData | null;
} {
  const rawWords = content.words;
  const safeContent: Record<string, unknown> = {
    words: Array.isArray(rawWords)
      ? rawWords.map((item: unknown) => {
          if (!isRecord(item) || typeof item.clue !== "string") {
            return { clue: "" };
          }

          return { clue: item.clue };
        })
      : [],
  };

  if (!generatedData || !Array.isArray(generatedData.grid) || !Array.isArray(generatedData.clues)) {
    return { content: safeContent, generatedData: null };
  }

  const rawGrid = generatedData.grid;
  const rows = rawGrid.length;
  const cols = rows > 0 && Array.isArray(rawGrid[0]) ? rawGrid[0].length : 0;

  if (
    rows < 1 ||
    rows > 25 ||
    generatedData.clues.length === 0 ||
    cols < 1 ||
    cols > 25 ||
    rawGrid.some(
      (row: unknown) =>
        !Array.isArray(row) ||
        row.length !== cols ||
        row.some((cell: unknown) => typeof cell !== "string"),
    ) ||
    generatedData.clues.some((clue: unknown) => !isRawClue(clue))
  ) {
    return { content: safeContent, generatedData: null };
  }

  const clues = generatedData.clues as RawCrosswordClue[];
  const grid: (string | null)[][] = Array.from(
    { length: rows },
    () => Array.from({ length: cols }, () => null),
  );

  for (const clue of clues) {
    const length = normalizeAnswer(clue.word).length;
    const fits =
      clue.row >= 0 &&
      clue.col >= 0 &&
      (clue.direction === "across"
        ? clue.row < rows && clue.col + length <= cols
        : clue.row + length <= rows && clue.col < cols);

    if (!fits || length < 1) {
      return { content: safeContent, generatedData: null };
    }

    for (let index = 0; index < length; index += 1) {
      const row = clue.row + (clue.direction === "down" ? index : 0);
      const col = clue.col + (clue.direction === "across" ? index : 0);
      grid[row][col] = "";
    }
  }

  return {
    content: safeContent,
    generatedData: {
      grid,
      clues: clues.map((clue) => ({
        number: clue.number,
        clue: clue.clue,
        direction: clue.direction,
        row: clue.row,
        col: clue.col,
        length: normalizeAnswer(clue.word).length,
      })),
    },
  };
}
