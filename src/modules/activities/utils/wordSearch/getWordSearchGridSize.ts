import { ActivityDifficulty } from "../../types/ActivityDifficulty";
import { normalizeWordSearchWord } from "./normalizeWordSearchWord";

const MIN_GRID_SIZE = 8;
const MAX_GRID_SIZE = 20;
const GRID_SIZE_STEP = 2;

const INITIAL_GRID_SIZE: Record<ActivityDifficulty, number> = {
  [ActivityDifficulty.EASY]: 8,
  [ActivityDifficulty.MEDIUM]: 10,
  [ActivityDifficulty.HARD]: 12,
};

export function getWordSearchGridSizes(
  difficulty: ActivityDifficulty,
  words: readonly string[],
): number[] {
  const initialSize = INITIAL_GRID_SIZE[difficulty];

  const longestWordLength = words.reduce((longest, word) => {
    const normalizedWord = normalizeWordSearchWord(word);

    return Math.max(longest, normalizedWord.letters.length);
  }, 0);

  if (longestWordLength > MAX_GRID_SIZE) {
    throw new RangeError(
      `A palavra mais longa excede o limite de ${MAX_GRID_SIZE} letras.`,
    );
  }

  const firstGridSize = Math.max(
    MIN_GRID_SIZE,
    initialSize,
    Math.ceil(longestWordLength / GRID_SIZE_STEP) * GRID_SIZE_STEP,
  );

  const gridSizes: number[] = [];

  for (
    let size = firstGridSize;
    size <= MAX_GRID_SIZE;
    size += GRID_SIZE_STEP
  ) {
    gridSizes.push(size);
  }

  return gridSizes;
}