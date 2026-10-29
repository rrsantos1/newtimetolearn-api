import { describe, expect, it } from "vitest";

import { normalizeWordSearchWord } from "../../src/modules/activities/utils/wordSearch/normalizeWordSearchWord";

describe("normalizeWordSearchWord", () => {
  it.each([
    ["Árvore", "ARVORE"],
    ["Coração", "CORACAO"],
    ["Educação", "EDUCACAO"],
    ["João", "JOAO"],
    ["Guarda-chuva", "GUARDACHUVA"],
    ["Água-viva", "AGUAVIVA"],
    ["Bem-estar", "BEMESTAR"],
    ["Pôr do sol", "PORDOSOL"],
  ])("deve normalizar %s para %s", (input, expected) => {
    const result = normalizeWordSearchWord(input);

    expect(result.normalized).toBe(expected);
  });

  it("deve preservar o texto original para exibição", () => {
    const result = normalizeWordSearchWord("  Pôr do sol  ");

    expect(result.original).toBe("Pôr do sol");
    expect(result.normalized).toBe("PORDOSOL");
  });

  it("deve retornar as letras na ordem correta", () => {
    const result = normalizeWordSearchWord("Árvore");

    expect(result.letters).toEqual([
      "A",
      "R",
      "V",
      "O",
      "R",
      "E",
    ]);
  });

  it("deve produzir a mesma representação para palavras equivalentes", () => {
    const first = normalizeWordSearchWord("Árvore");
    const second = normalizeWordSearchWord("arvore");

    expect(first.normalized).toBe(second.normalized);
  });
});