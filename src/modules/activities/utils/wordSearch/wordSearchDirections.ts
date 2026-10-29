import { ActivityDifficulty } from "../../types/ActivityDifficulty";

export type WordSearchDirectionName =
  | "right"
  | "down"
  | "down-right"
  | "left"
  | "up"
  | "down-left"
  | "up-right"
  | "up-left";

export interface WordSearchDirection {
  dx: number;
  dy: number;
  name: WordSearchDirectionName;
}

const EASY_DIRECTIONS: readonly WordSearchDirection[] = [
  { dx: 0, dy: 1, name: "right" },
  { dx: 1, dy: 0, name: "down" },
];

const MEDIUM_DIRECTIONS: readonly WordSearchDirection[] = [
  ...EASY_DIRECTIONS,
  { dx: 1, dy: 1, name: "down-right" },
];

const HARD_DIRECTIONS: readonly WordSearchDirection[] = [
  ...MEDIUM_DIRECTIONS,
  { dx: 0, dy: -1, name: "left" },
  { dx: -1, dy: 0, name: "up" },
  { dx: 1, dy: -1, name: "down-left" },
  { dx: -1, dy: 1, name: "up-right" },
  { dx: -1, dy: -1, name: "up-left" },
];

export function getWordSearchDirections(
  difficulty: ActivityDifficulty,
): readonly WordSearchDirection[] {
  switch (difficulty) {
    case ActivityDifficulty.EASY:
      return EASY_DIRECTIONS;

    case ActivityDifficulty.MEDIUM:
      return MEDIUM_DIRECTIONS;

    case ActivityDifficulty.HARD:
      return HARD_DIRECTIONS;

    default: {
      const exhaustiveCheck: never = difficulty;
      throw new Error(
        `Dificuldade não suportada: ${String(exhaustiveCheck)}`,
      );
    }
  }
}