import { describe, expect, it } from "vitest";
import { sanitizeCrosswordForExecution } from "../../src/modules/activities/utils/crossword/sanitizeCrosswordForExecution";

describe("sanitizeCrosswordForExecution", () => {
  const contentData: Record<string, unknown> = {
    title: "Animais",
    words: [
      { word: "CÃO", clue: "Melhor amigo do homem" },
      { word: "GATO", clue: "Felino doméstico" },
    ],
  };

  const generatedData: Record<string, unknown> = {
    grid: [
      ["C", "A", "O"],
      ["", "", ""],
      ["G", "A", "T"],
    ],
    clues: [
      { number: 1, clue: "Melhor amigo do homem", direction: "across", row: 0, col: 0, word: "CAO" },
      { number: 2, clue: "Felino doméstico", direction: "across", row: 2, col: 0, word: "GATO" },
    ],
  };

  it("remove respostas do conteúdo, da grade e das pistas", () => {
    const result = sanitizeCrosswordForExecution(contentData, generatedData);

    expect(result.content.words).toEqual([
      { clue: "Melhor amigo do homem" },
      { clue: "Felino doméstico" },
    ]);
    expect(JSON.stringify(result)).not.toContain('"word"');
    expect(result.generatedData?.grid).toEqual([
      ["", "", "", null],
      [null, null, null, null],
      ["", "", "", ""],
    ]);
    expect(result.generatedData?.clues).toEqual([
      { number: 1, clue: "Melhor amigo do homem", direction: "across", row: 0, col: 0, length: 3 },
      { number: 2, clue: "Felino doméstico", direction: "across", row: 2, col: 0, length: 4 },
    ]);
  });

  it("não envia dados gerados malformados", () => {
    const result = sanitizeCrosswordForExecution(contentData, {
      grid: [["A"], ["A", "B"]],
      clues: [{ number: 1, clue: "Pista", direction: "across", row: 0, col: 0, word: "A" }],
    });

    expect(result.generatedData).toBeNull();
    expect(result.content.words).toEqual([
      { clue: "Melhor amigo do homem" },
      { clue: "Felino doméstico" },
    ]);
  });

  it("não expõe conteúdo quando os dados gerados estão ausentes", () => {
    const result = sanitizeCrosswordForExecution(contentData, null);

    expect(result.generatedData).toBeNull();
    expect(JSON.stringify(result.content)).not.toContain("CÃO");
    expect(JSON.stringify(result.content)).not.toContain("GATO");
  });
});
