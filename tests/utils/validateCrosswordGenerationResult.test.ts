import { describe, expect, it } from "vitest";
import { CrosswordGenerationError } from "../../src/modules/activities/errors/CrosswordGenerationError";
import { validateCrosswordGenerationResult } from "../../src/modules/activities/utils/crossword/validateCrosswordGenerationResult";

const words = ["Água-viva", "Oceano", "Planeta"];

const placements = [
  { word: { word: "AGUAVIVA" }, row: 2, col: 1, direction: "across" as const },
  { word: { word: "OCEANO" }, row: 1, col: 3, direction: "down" as const },
  { word: { word: "PLANETA" }, row: 5, col: 2, direction: "across" as const },
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

  it("rejeita uma resposta posicionada fora da grade", () => {
    expect(() =>
      validateCrosswordGenerationResult(
        words,
        [
          ...placements.slice(0, 2),
          { word: { word: "PLANETA" }, row: 5, col: 5, direction: "across" },
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
});
