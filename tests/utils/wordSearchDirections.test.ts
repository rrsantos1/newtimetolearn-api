import { describe, expect, it } from "vitest";
import { ActivityDifficulty } from "../../src/modules/activities/types/ActivityDifficulty";
import { getWordSearchDirections } from "../../src/modules/activities/utils/wordSearch/wordSearchDirections";

describe("getWordSearchDirections", () => {
  it("deve permitir apenas direita e baixo na dificuldade fácil", () => {
    const directions = getWordSearchDirections(
      ActivityDifficulty.EASY,
    );

    expect(directions.map((direction) => direction.name)).toEqual([
      "right",
      "down",
    ]);
  });

  it("deve permitir três direções na dificuldade média", () => {
    const directions = getWordSearchDirections(
      ActivityDifficulty.MEDIUM,
    );

    expect(directions.map((direction) => direction.name)).toEqual([
      "right",
      "down",
      "down-right",
    ]);
  });

  it("deve permitir oito direções na dificuldade difícil", () => {
    const directions = getWordSearchDirections(
      ActivityDifficulty.HARD,
    );

    expect(directions).toHaveLength(8);
  });

  it("deve manter os vetores de deslocamento coerentes com as direções", () => {
    const directions = getWordSearchDirections(
      ActivityDifficulty.HARD,
    );

    expect(directions).toContainEqual({
      dx: 0,
      dy: 1,
      name: "right",
    });

    expect(directions).toContainEqual({
      dx: -1,
      dy: -1,
      name: "up-left",
    });
  });
});