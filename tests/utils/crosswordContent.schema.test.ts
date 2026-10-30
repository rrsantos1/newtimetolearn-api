import { describe, expect, it } from "vitest";
import { crosswordContentSchema } from "../../src/modules/activities/schemas/content/crosswordContent.schema";
import { normalizeCrosswordAnswer } from "../../src/modules/activities/utils/crossword/normalizeCrosswordAnswer";

describe("normalizeCrosswordAnswer", () => {
  it("remove acentos, espaços e hífens para a resposta interna", () => {
    expect(normalizeCrosswordAnswer(" Água-Viva ").normalized).toBe("AGUAVIVA");
    expect(normalizeCrosswordAnswer("Sistema Solar").normalized).toBe("SISTEMASOLAR");
  });
});

describe("crosswordContentSchema", () => {
  const validContent = {
    words: [
      { word: "Água-viva", clue: "Animal marinho" },
      { word: "Oceano", clue: "Grande massa de água salgada" },
      { word: "Sistema Solar", clue: "Conjunto formado por uma estrela e corpos celestes" },
    ],
  };

  it("aceita respostas e pistas válidas", () => {
    expect(crosswordContentSchema.safeParse(validContent).success).toBe(true);
  });

  it("rejeita menos de 3 palavras", () => {
    expect(
      crosswordContentSchema.safeParse({
        words: validContent.words.slice(0, 2),
      }).success,
    ).toBe(false);
  });

  it("rejeita mais de 20 palavras", () => {
    const words = Array.from({ length: 21 }, (_, index) => ({
      word: `Resposta${index}`,
      clue: `Pista ${index}`,
    }));

    expect(crosswordContentSchema.safeParse({ words }).success).toBe(false);
  });

  it("rejeita respostas repetidas após normalização", () => {
    expect(
      crosswordContentSchema.safeParse({
        words: [
          { word: "Água-viva", clue: "Pista A" },
          { word: "AGUAVIVA", clue: "Pista B" },
          { word: "Oceano", clue: "Pista C" },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejeita respostas com mais de 25 letras normalizadas", () => {
    expect(
      crosswordContentSchema.safeParse({
        words: [
          { word: "A".repeat(26), clue: "Pista A" },
          { word: "Oceano", clue: "Pista B" },
          { word: "Planeta", clue: "Pista C" },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejeita pistas vazias", () => {
    expect(
      crosswordContentSchema.safeParse({
        words: [
          { word: "Água-viva", clue: " " },
          { word: "Oceano", clue: "Pista B" },
          { word: "Planeta", clue: "Pista C" },
        ],
      }).success,
    ).toBe(false);
  });
});
