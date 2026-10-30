import { describe, expect, it } from "vitest";
import { CrosswordGenerationError } from "../../src/modules/activities/errors/CrosswordGenerationError";
import { validateCrosswordGenerationResult } from "../../src/modules/activities/utils/crossword/validateCrosswordGenerationResult";

const words = ["Água-viva", "Viva", "Planeta"];

const placements = [
  { word: { word: "AGUAVIVA" }, row: 2, col: 1, direction: "across" as const },
  { word: { word: "VIVA" }, row: 1, col: 6, direction: "down" as const },
  { word: { word: "PLANETA" }, row: 0, col: 1, direction: "down" as const },
];

describe("validateCrosswordGenerationResult", () => {
  it("aceita uma grade com todas as respostas dentro dos limites", () => {
    expect(() =>
      validateCrosswordGenerationResult(words, placements, 10, 10),
    ).not.toThrow();
  });

  it("rejeita geração incompleta", () => {
    expect(() =>
      validateCrosswordGenerationResult(words, placements.slice(0, 2), 10, 10),
    ).toThrowError(CrosswordGenerationError);
  });

  it("rejeita respostas ausentes substituídas por duplicatas", () => {
    expect(() =>
      validateCrosswordGenerationResult(
        words,
        [
          placements[0],
          { word: { word: "AGUAVIVA" }, row: 1, col: 1, direction: "down" },
          placements[2],
        ],
        10,
        10,
      ),
    ).toThrowError(CrosswordGenerationError);
  });

  it("rejeita uma resposta posicionada fora da grade", () => {
    expect(() =>
      validateCrosswordGenerationResult(
        words,
        [
          ...placements.slice(0, 2),
          { word: { word: "PLANETA" }, row: 7, col: 5, direction: "across" },
        ],
        10,
        10,
      ),
    ).toThrowError(CrosswordGenerationError);
  });

  it("rejeita cruzamentos com letras incompatíveis", () => {
    expect(() =>
      validateCrosswordGenerationResult(
        words,
        [
          placements[0],
          { word: { word: "VIVA" }, row: 1, col: 2, direction: "down" },
          placements[2],
        ],
        10,
        10,
      ),
    ).toThrowError(CrosswordGenerationError);
  });

  it("rejeita sobreposição de palavras na mesma orientação", () => {
    expect(() =>
      validateCrosswordGenerationResult(
        words,
        [
          placements[0],
          { word: { word: "VIVA" }, row: 2, col: 2, direction: "across" },
          placements[2],
        ],
        10,
        10,
      ),
    ).toThrowError(CrosswordGenerationError);
  });

  it("rejeita respostas que não fazem parte da mesma estrutura conectada", () => {
    expect(() =>
      validateCrosswordGenerationResult(
        words,
        [
          placements[0],
          placements[1],
          { word: { word: "PLANETA" }, row: 8, col: 2, direction: "across" },
        ],
        10,
        10,
      ),
    ).toThrowError(CrosswordGenerationError);
  });

  it("rejeita dimensões acima do limite do produto", () => {
    expect(() =>
      validateCrosswordGenerationResult(words, placements, 26, 25),
    ).toThrowError(CrosswordGenerationError);
  });

  it("rejeita uma orientação inválida em runtime", () => {
    const invalidPlacement = {
      ...placements[0],
      direction: "diagonal",
    };

    expect(() =>
      validateCrosswordGenerationResult(
        words,
        [invalidPlacement, placements[1], placements[2]],
        10,
        10,
      ),
    ).toThrowError(CrosswordGenerationError);
  });
});
