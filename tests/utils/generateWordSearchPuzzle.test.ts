import { describe, expect, it } from "vitest";
import { ActivityDifficulty } from "../../src/modules/activities/types/ActivityDifficulty";
import { generateWordSearchPuzzle } from "../../src/modules/activities/utils/wordSearch/generateWordSearchPuzzle";
import { getWordSearchDirections } from "../../src/modules/activities/utils/wordSearch/wordSearchDirections";

function createSeededRandom(seed: number): () => number {
  let state = seed;

  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;

    return state / 4294967296;
  };
}

describe("generateWordSearchPuzzle", () => {
  it("deve gerar uma grade quadrada", () => {
    const result = generateWordSearchPuzzle(
      ["CASA", "BOLA", "GATO"],
      ActivityDifficulty.EASY,
      createSeededRandom(123),
    );

    expect(result.grid.length).toBeGreaterThanOrEqual(8);
    expect(result.grid.length).toBeLessThanOrEqual(20);

    for (const row of result.grid) {
      expect(row).toHaveLength(result.grid.length);
    }
  });

  it("deve posicionar todas as palavras", () => {
    const words = ["CASA", "BOLA", "GATO"];

    const result = generateWordSearchPuzzle(
      words,
      ActivityDifficulty.EASY,
      createSeededRandom(456),
    );

    expect(result.wordPositions).toHaveLength(words.length);

    expect(
      result.wordPositions.map((position) => position.word),
    ).toEqual(words);
  });

  it("deve remover os acentos das palavras posicionadas na grade", () => {
    const result = generateWordSearchPuzzle(
      ["ÁRVORE", "CORAÇÃO", "EDUCAÇÃO"],
      ActivityDifficulty.EASY,
      createSeededRandom(789),
    );

    expect(
      result.wordPositions.map((position) => position.word),
    ).toEqual(["ARVORE", "CORACAO", "EDUCACAO"]);
  });

  it("deve permitir somente direções compatíveis com a dificuldade", () => {
    const result = generateWordSearchPuzzle(
      ["CASA", "BOLA", "GATO"],
      ActivityDifficulty.EASY,
      createSeededRandom(321),
    );

    const allowedDirections = getWordSearchDirections(
      ActivityDifficulty.EASY,
    ).map((direction) => direction.name);

    for (const position of result.wordPositions) {
      expect(allowedDirections).toContain(position.direction);
    }
  });

  it("deve preencher todas as células da grade", () => {
    const result = generateWordSearchPuzzle(
      ["CASA", "BOLA", "GATO"],
      ActivityDifficulty.MEDIUM,
      createSeededRandom(654),
    );

    for (const row of result.grid) {
      for (const cell of row) {
        expect(cell).toMatch(/^[A-Z]$/);
      }
    }
  });

  it("deve garantir que cada palavra corresponda às suas coordenadas", () => {
    const result = generateWordSearchPuzzle(
      ["CASA", "BOLA", "GATO"],
      ActivityDifficulty.HARD,
      createSeededRandom(987),
    );

    const directions = getWordSearchDirections(
      ActivityDifficulty.HARD,
    );

    for (const position of result.wordPositions) {
      const direction = directions.find(
        (item) => item.name === position.direction,
      );

      expect(direction).toBeDefined();

      if (direction === undefined) {
        throw new Error("Direção inválida no resultado do gerador.");
      }

      const letters: string[] = [];

      for (
        let index = 0;
        index < position.word.length;
        index += 1
      ) {
        const row = position.row + index * direction.dx;
        const col = position.col + index * direction.dy;

        letters.push(result.grid[row][col]);
      }

      expect(letters.join("")).toBe(position.word);
    }
  });

  it("deve rejeitar palavras repetidas após normalização", () => {
    expect(() =>
      generateWordSearchPuzzle(
        ["ÁRVORE", "ARVORE"],
        ActivityDifficulty.EASY,
        createSeededRandom(111),
      ),
    ).toThrow(/palavras repetidas/i);
  });

  it("deve rejeitar palavras com mais de 20 letras normalizadas", () => {
    expect(() =>
      generateWordSearchPuzzle(
        ["A".repeat(21)],
        ActivityDifficulty.EASY,
        createSeededRandom(222),
      ),
    ).toThrow(/20 letras/i);
  });

  it("deve rejeitar uma lista vazia", () => {
    expect(() =>
      generateWordSearchPuzzle(
        [],
        ActivityDifficulty.EASY,
        createSeededRandom(333),
      ),
    ).toThrow(/pelo menos uma palavra/i);
  });

  it("deve rejeitar palavras com menos de duas letras normalizadas", () => {
    expect(() =>
        generateWordSearchPuzzle(
        ["A"],
        ActivityDifficulty.EASY,
        createSeededRandom(444),
        ),
    ).toThrow(/pelo menos 2 letras/i);
  });

  it("deve aumentar a grade quando a maior palavra não couber no tamanho inicial", () => {
    const result = generateWordSearchPuzzle(
        ["A".repeat(9), "BOLA"],
        ActivityDifficulty.EASY,
        createSeededRandom(123),
    );

    expect(result.grid.length).toBeGreaterThan(8);
    expect(result.grid.length).toBeLessThanOrEqual(20);

    for (const row of result.grid) {
        expect(row).toHaveLength(result.grid.length);
    }

    expect(
        result.wordPositions.map((position) => position.word),
    ).toEqual(["AAAAAAAAA", "BOLA"]);
  });

  it.each([
    {
        difficulty: ActivityDifficulty.EASY,
        allowedDirections: ["right", "down"],
    },
    {
        difficulty: ActivityDifficulty.MEDIUM,
        allowedDirections: ["right", "down", "down-right"],
    },
    {
        difficulty: ActivityDifficulty.HARD,
        allowedDirections: [
        "right",
        "down",
        "down-right",
        "left",
        "up",
        "down-left",
        "up-right",
        "up-left",
        ],
    },
    ])(
    "deve respeitar as direções permitidas na dificuldade $difficulty",
    ({ difficulty, allowedDirections }) => {
        const result = generateWordSearchPuzzle(
        ["EXTRAORDINARIO", "CASA", "SOL"],
        difficulty,
        createSeededRandom(123),
        );

        for (const position of result.wordPositions) {
        expect(allowedDirections).toContain(position.direction);
        }
    },
  );

  it("deve preservar a ordem original das palavras no resultado", () => {
    const words = ["SOL", "EXTRAORDINARIO", "CASA", "BORBOLETA"];

    const result = generateWordSearchPuzzle(
        words,
        ActivityDifficulty.MEDIUM,
        createSeededRandom(456),
    );

    expect(
        result.wordPositions.map((position) => position.word),
    ).toEqual(words);
  });
});