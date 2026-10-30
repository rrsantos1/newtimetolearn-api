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

  if (expectedWords.some((word) => word.length === 0)) {
    throw new CrosswordGenerationError(
      "A configuração contém uma resposta vazia após a normalização.",
      "INCOMPLETE_GENERATION",
    );
  }

  const expectedCounts = new Map<string, number>();
  const placedCounts = new Map<string, number>();

  for (const word of expectedWords) {
    expectedCounts.set(word, (expectedCounts.get(word) ?? 0) + 1);
  }

  for (const word of placedWords) {
    placedCounts.set(word, (placedCounts.get(word) ?? 0) + 1);
  }

  const hasSameWordCounts =
    expectedCounts.size === placedCounts.size &&
    [...expectedCounts].every(
      ([word, count]) => placedCounts.get(word) === count,
    );

  if (expectedWords.length !== placedWords.length || !hasSameWordCounts) {
    throw new CrosswordGenerationError(
      "O gerador não posicionou todas as respostas exatamente uma vez.",
      "INCOMPLETE_GENERATION",
    );
  }

  const occupiedCells = new Map<
    string,
    { letter: string; direction: "across" | "down"; placementIndex: number }
  >();
  const cellPlacements = new Map<string, Set<number>>();
  const connectedPlacements = placements.map(() => new Set<number>());

  for (const [placementIndex, placement] of placements.entries()) {
    const normalizedWord = normalizeCrosswordAnswer(placement.word.word).normalized;
    const length = normalizedWord.length;
    const hasValidCoordinates =
      Number.isInteger(placement.row) &&
      Number.isInteger(placement.col);
    const hasValidDirection =
      placement.direction === "across" || placement.direction === "down";

    const fits =
      hasValidCoordinates &&
      hasValidDirection &&
      (placement.direction === "across"
        ? placement.row >= 0 &&
          placement.row < rows &&
          placement.col >= 0 &&
          placement.col + length <= cols
        : placement.row >= 0 &&
          placement.row + length <= rows &&
          placement.col >= 0 &&
          placement.col < cols);

    if (!fits || length < 1) {
      throw new CrosswordGenerationError(
        `A resposta "${placement.word.word}" possui um posicionamento inválido ou fora da grade.`,
        "INVALID_PLACEMENT",
      );
    }

    for (let index = 0; index < length; index += 1) {
      const row =
        placement.row + (placement.direction === "down" ? index : 0);
      const col =
        placement.col + (placement.direction === "across" ? index : 0);
      const key = `${row}:${col}`;
      const existingCell = occupiedCells.get(key);
      const letter = normalizedWord[index];
      const occupants = cellPlacements.get(key) ?? new Set<number>();
      occupants.add(placementIndex);
      cellPlacements.set(key, occupants);

      if (occupants.size > 2) {
        throw new CrosswordGenerationError(
          `Mais de duas respostas cruzam a mesma célula (${row}, ${col}).`,
          "INVALID_PLACEMENT",
        );
      }

      if (existingCell) {
        const isPerpendicularCrossing =
          existingCell.direction !== placement.direction;
        const hasMatchingLetter = existingCell.letter === letter;

        if (!isPerpendicularCrossing || !hasMatchingLetter) {
          throw new CrosswordGenerationError(
            `O posicionamento da resposta "${placement.word.word}" conflita com outra resposta na célula (${row}, ${col}).`,
            "INVALID_PLACEMENT",
          );
        }

        connectedPlacements[placementIndex].add(existingCell.placementIndex);
        connectedPlacements[existingCell.placementIndex].add(placementIndex);
      } else {
        occupiedCells.set(key, {
          letter,
          direction: placement.direction,
          placementIndex,
        });
      }
    }
  }

  for (const [placementIndex, placement] of placements.entries()) {
    const normalizedWord = normalizeCrosswordAnswer(placement.word.word).normalized;
    for (let index = 0; index < normalizedWord.length; index += 1) {
      const row = placement.row + (placement.direction === "down" ? index : 0);
      const col = placement.col + (placement.direction === "across" ? index : 0);
      const key = `${row}:${col}`;
      const occupants = cellPlacements.get(key) ?? new Set<number>();
      const crossingIndices = [...occupants].filter(
        (otherIndex) =>
          otherIndex !== placementIndex &&
          placements[otherIndex].direction !== placement.direction,
      );
      const neighbors = placement.direction === "across"
        ? [{ row: row - 1, col }, { row: row + 1, col }]
        : [{ row, col: col - 1 }, { row, col: col + 1 }];

      for (const neighbor of neighbors) {
        const neighborOccupants = cellPlacements.get(`${neighbor.row}:${neighbor.col}`);
        if (
          neighborOccupants &&
          [...neighborOccupants].some((otherIndex) => !crossingIndices.includes(otherIndex))
        ) {
          throw new CrosswordGenerationError(
            `A resposta "${placement.word.word}" forma uma sequência adjacente não cruzada.`,
            "INVALID_PLACEMENT",
          );
        }
      }
    }

    const before = placement.direction === "across"
      ? { row: placement.row, col: placement.col - 1 }
      : { row: placement.row - 1, col: placement.col };
    const after = placement.direction === "across"
      ? { row: placement.row, col: placement.col + normalizedWord.length }
      : { row: placement.row + normalizedWord.length, col: placement.col };

    if (
      cellPlacements.has(`${before.row}:${before.col}`) ||
      cellPlacements.has(`${after.row}:${after.col}`)
    ) {
      throw new CrosswordGenerationError(
        `A resposta "${placement.word.word}" está encostada a outra sequência na mesma orientação.`,
        "INVALID_PLACEMENT",
      );
    }
  }

  if (placements.length > 1) {
    const visited = new Set<number>();
    const pending = [0];

    while (pending.length > 0) {
      const currentIndex = pending.pop();

      if (currentIndex === undefined || visited.has(currentIndex)) {
        continue;
      }

      visited.add(currentIndex);

      for (const neighbor of connectedPlacements[currentIndex]) {
        if (!visited.has(neighbor)) {
          pending.push(neighbor);
        }
      }
    }

    if (visited.size !== placements.length) {
      throw new CrosswordGenerationError(
        "Todas as respostas precisam formar uma única estrutura conectada.",
        "INVALID_PLACEMENT",
      );
    }
  }
}
