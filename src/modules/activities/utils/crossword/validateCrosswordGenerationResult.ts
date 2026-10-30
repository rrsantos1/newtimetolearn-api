import { CrosswordGenerationError } from "../../errors/CrosswordGenerationError";
import { normalizeCrosswordAnswer } from "./normalizeCrosswordAnswer";

export interface CrosswordGeneratedPlacement {
  readonly word: {
    readonly word: string;
  };
  readonly row: number;
  readonly col: number;
  readonly direction: "across" | "down";
}

export function validateCrosswordGenerationResult(
  inputWords: readonly string[],
  placements: readonly CrosswordGeneratedPlacement[],
  rows: number,
  cols: number,
): void {
  if (
    !Number.isInteger(rows) ||
    !Number.isInteger(cols) ||
    rows < 1 ||
    cols < 1 ||
    rows > 25 ||
    cols > 25
  ) {
    throw new CrosswordGenerationError(
      "As dimensões da grade devem ser inteiras e estar entre 1 e 25.",
      "INVALID_BOARD",
    );
  }

  if (inputWords.length === 0) {
    throw new CrosswordGenerationError(
      "A cruzadinha precisa conter palavras.",
      "INCOMPLETE_GENERATION",
    );
  }

  const expectedWords = inputWords.map(
    (word) => normalizeCrosswordAnswer(word).normalized,
  );
  const placedWords = placements.map(
    (placement) => normalizeCrosswordAnswer(placement.word.word).normalized,
  );

  if (
    expectedWords.length !== placedWords.length ||
    expectedWords.some((word) => !placedWords.includes(word)) ||
    placedWords.some((word) => !expectedWords.includes(word))
  ) {
    throw new CrosswordGenerationError(
      "O gerador não posicionou todas as respostas exatamente uma vez.",
      "INCOMPLETE_GENERATION",
    );
  }

  for (const placement of placements) {
    const normalizedWord = normalizeCrosswordAnswer(placement.word.word).normalized;
    const length = normalizedWord.length;

    const fits =
      placement.direction === "across"
        ? placement.row >= 0 &&
          placement.row < rows &&
          placement.col >= 0 &&
          placement.col + length <= cols
        : placement.row >= 0 &&
          placement.row + length <= rows &&
          placement.col >= 0 &&
          placement.col < cols;

    if (!fits) {
      throw new CrosswordGenerationError(
        `A resposta "${placement.word.word}" possui um posicionamento fora da grade.`,
        "INVALID_PLACEMENT",
      );
    }
  }
}
