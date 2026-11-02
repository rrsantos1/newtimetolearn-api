import { describe, expect, it } from "vitest";
import { CrosswordBoard } from "../../src/modules/activities/utils/crossword/board/CrosswordBoard";
import { CrosswordBuilder } from "../../src/modules/activities/utils/crossword/CrosswordBuilder";
import { CrosswordGenerationError } from "../../src/modules/activities/errors/CrosswordGenerationError";
import { generateCrosswordPuzzle } from "../../src/modules/activities/utils/crossword/generateCrosswordPuzzle";

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
  it("posiciona palavras curtas em uma cruzadinha sobre o sistema solar", () => {
    const words = [
      { word: "SISTEMASOLAR", clue: "Conjunto formado pelo Sol e corpos celestes" },
      { word: "MERCURIO", clue: "Planeta mais próximo do Sol" },
      { word: "VENUS", clue: "Segundo planeta do sistema solar" },
      { word: "TERRA", clue: "Planeta onde vivemos" },
      { word: "MARTE", clue: "Planeta vermelho" },
      { word: "JUPITER", clue: "Maior planeta do sistema solar" },
      { word: "SATURNO", clue: "Planeta conhecido por seus anéis" },
      { word: "URANO", clue: "Planeta gigante gelado" },
      { word: "NETUNO", clue: "Planeta mais distante do Sol" },
      { word: "LUA", clue: "Satélite natural da Terra" },
      { word: "SOL", clue: "Estrela do sistema solar" },
      { word: "ASTRO", clue: "Corpo celeste" },
    ];

    const result = generateCrosswordPuzzle(words, 25, 25);

    expect(result.clues).toHaveLength(words.length);
    expect(result.clues.map((clue) => clue.word)).toContain("LUA");
    expect(result.clues.map((clue) => clue.word)).toContain("SOL");
  });

  it("posiciona todas as palavras quando existem cruzamentos alternativos", () => {
    const board = new CrosswordBoard(25, 25);
    const builder = new CrosswordBuilder(board);

    const result = builder.build([
      { word: "CASA", clue: "Lugar onde se mora" },
      { word: "SALA", clue: "Cômodo da casa" },
      { word: "ASA", clue: "Parte usada para voar" },
    ]);

    expect(result.getPlacements()).toHaveLength(3);
  });
});
