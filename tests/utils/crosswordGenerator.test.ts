import { describe, expect, it } from "vitest";
import { CrosswordBoard } from "../../src/modules/activities/utils/crossword/board/CrosswordBoard";
import { CrosswordBuilder } from "../../src/modules/activities/utils/crossword/CrosswordBuilder";
import { CrosswordGenerationError } from "../../src/modules/activities/errors/CrosswordGenerationError";

describe("gerador de palavras cruzadas", () => {
  it("reconstrói o índice de letras usando as células clonadas", () => {
    const board = new CrosswordBoard(5, 5);
    const originalCell = board.getOrCreateCell(1, 2, "A");

    const clonedBoard = board.clone();
    const clonedCell = clonedBoard.getCell(1, 2);
    const indexedCells = [...clonedBoard.getLetterCells("A")];

    expect(clonedCell).toBeDefined();
    expect(clonedCell).not.toBe(originalCell);
    expect(indexedCells).toContain(clonedCell);
    expect(indexedCells).not.toContain(originalCell);
  });

  it("retorna erro controlado quando não consegue posicionar todas as respostas", () => {
    const board = new CrosswordBoard(10, 10);
    const builder = new CrosswordBuilder(board);

    let caughtError: unknown;

    try {
      builder.build([
        { word: "ABC", clue: "Primeira resposta" },
        { word: "XYZ", clue: "Segunda resposta sem letras em comum" },
      ]);
    } catch (error: unknown) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(CrosswordGenerationError);
    expect((caughtError as CrosswordGenerationError).code).toBe("INCOMPLETE_GENERATION");
  });
});
