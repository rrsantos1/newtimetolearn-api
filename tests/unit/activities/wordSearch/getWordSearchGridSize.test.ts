import { describe, expect, it } from "vitest";
import { ActivityDifficulty } from "../../../../src/modules/activities/types/ActivityDifficulty";
import { getWordSearchGridSizes } from "../../../../src/modules/activities/utils/wordSearch/getWordSearchGridSize";

describe("getWordSearchGridSizes", () => {
  it("deve começar com uma grade 12x12 para dificuldade fácil", () => {
    const result = getWordSearchGridSizes(
      ActivityDifficulty.EASY,
      ["CASA", "BOLA", "GATO"],
    );

    expect(result[0]).toBe(12);
  });

  it("deve começar com uma grade 14x14 para dificuldade média", () => {
    const result = getWordSearchGridSizes(
      ActivityDifficulty.MEDIUM,
      ["CASA", "BOLA", "GATO"],
    );

    expect(result[0]).toBe(14);
  });

  it("deve começar com uma grade 16x16 para dificuldade difícil", () => {
    const result = getWordSearchGridSizes(
      ActivityDifficulty.HARD,
      ["CASA", "BOLA", "GATO"],
    );

    expect(result[0]).toBe(16);
  });

  it("deve aumentar a grade em intervalos de duas unidades", () => {
    const result = getWordSearchGridSizes(
      ActivityDifficulty.EASY,
      ["CASA", "BOLA", "GATO"],
    );

    expect(result).toEqual([
      12, 14, 16, 18, 20,
    ]);
  });

  it("deve considerar o tamanho da maior palavra", () => {
    const result = getWordSearchGridSizes(
      ActivityDifficulty.EASY,
      ["CASA", "BOLA", "EXTRAORDINARIAMENTE"],
    );

    expect(result[0]).toBe(20);
  });

  it("deve considerar espaços e hífens ao calcular o tamanho", () => {
    const result = getWordSearchGridSizes(
      ActivityDifficulty.MEDIUM,
      ["GUARDA-CHUVA", "PÔR DO SOL", "BEM-ESTAR"],
    );

    expect(result[0]).toBe(14);
  });

  it("deve permitir uma palavra com exatamente 20 letras", () => {
    const word = "A".repeat(20);

    const result = getWordSearchGridSizes(
      ActivityDifficulty.EASY,
      [word],
    );

    expect(result[0]).toBe(20);
    expect(result[result.length - 1]).toBe(20);
  });

  it("deve rejeitar palavras com mais de 20 letras normalizadas", () => {
    const word = "A".repeat(21);

    expect(() =>
      getWordSearchGridSizes(
        ActivityDifficulty.EASY,
        [word],
      ),
    ).toThrow(RangeError);
  });
});