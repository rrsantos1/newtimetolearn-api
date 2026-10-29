import { ActivityDifficulty } from "../../types/ActivityDifficulty";
import { normalizeWordSearchWord } from "./normalizeWordSearchWord";
import { getWordSearchGridSizes } from "./getWordSearchGridSize";
import {
  getWordSearchDirections,
  type WordSearchDirection,
  type WordSearchDirectionName,
} from "./wordSearchDirections";
import { WordSearchPlacementError } from "../../errors/WordSearchPlacementError";

const MAX_GRID_ATTEMPTS = 50;
const MAX_PLACEMENT_ATTEMPTS = 100;
const RANDOM_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

type GridCell = string | null;

interface PreparedWord {
  normalized: string;
  letters: string[];
  originalIndex: number;
}

interface WordPlacement {
  row: number;
  col: number;
  direction: WordSearchDirectionName;
}

export interface WordSearchWordPosition extends WordPlacement {
  word: string;
}

export interface GeneratedWordSearchPuzzle {
  grid: string[][];
  wordPositions: WordSearchWordPosition[];
}

function createEmptyGrid(size: number): GridCell[][] {
  return Array.from(
    { length: size },
    () => Array<GridCell>(size).fill(null),
  );
}

function getRandomIndex(
  length: number,
  random: () => number,
): number {
  return Math.floor(random() * length);
}

function canPlaceWord(
  grid: GridCell[][],
  letters: readonly string[],
  row: number,
  col: number,
  direction: WordSearchDirection,
): boolean {
  const size = grid.length;

  for (let index = 0; index < letters.length; index += 1) {
    const newRow = row + index * direction.dx;
    const newCol = col + index * direction.dy;

    if (
      newRow < 0 ||
      newRow >= size ||
      newCol < 0 ||
      newCol >= size
    ) {
      return false;
    }

    const gridRow = grid[newRow];

    if (!gridRow) {
      return false;
    }

    const existingLetter = gridRow[newCol];

    if (
      existingLetter !== null &&
      existingLetter !== letters[index]
    ) {
      return false;
    }
  }

  return true;
}

function placeWord(
  grid: GridCell[][],
  word: PreparedWord,
  directions: readonly WordSearchDirection[],
  random: () => number,
): WordPlacement | null {
  const size = grid.length;

  for (
    let attempt = 0;
    attempt < MAX_PLACEMENT_ATTEMPTS;
    attempt += 1
  ) {
    const direction =
      directions[getRandomIndex(directions.length, random)];

    if (!direction) {
      continue;
    }

    const row = getRandomIndex(size, random);
    const col = getRandomIndex(size, random);

    if (
      !canPlaceWord(
        grid,
        word.letters,
        row,
        col,
        direction,
      )
    ) {
      continue;
    }

    for (
      let index = 0;
      index < word.letters.length;
      index += 1
    ) {
      const newRow = row + index * direction.dx;
      const newCol = col + index * direction.dy;
      const gridRow = grid[newRow];
      const letter = word.letters[index];

      if (!gridRow || letter === undefined) {
        return null;
      }

      gridRow[newCol] = letter;
    }

    return {
      row,
      col,
      direction: direction.name,
    };
  }

  return null;
}

function fillEmptyCells(
  grid: GridCell[][],
  random: () => number,
): string[][] {
  return grid.map((row) =>
    row.map((cell) => {
      if (cell !== null) {
        return cell;
      }

      return RANDOM_LETTERS.charAt(
        getRandomIndex(RANDOM_LETTERS.length, random),
      );
    }),
  );
}

function prepareWords(
  words: readonly string[],
): PreparedWord[] {
  const normalizedWords = new Set<string>();

  return words.map((word, originalIndex) => {
    const normalizedWord = normalizeWordSearchWord(word);

    if (normalizedWord.letters.length < 2) {
      throw new RangeError(
        "Cada palavra deve conter pelo menos 2 letras normalizadas.",
      );
    }

    if (normalizedWord.letters.length > 20) {
      throw new RangeError(
        "Cada palavra pode conter no máximo 20 letras normalizadas.",
      );
    }

    if (normalizedWords.has(normalizedWord.normalized)) {
      throw new RangeError(
        "Não é permitido gerar um caça-palavras com palavras repetidas.",
      );
    }

    normalizedWords.add(normalizedWord.normalized);

    return {
      normalized: normalizedWord.normalized,
      letters: normalizedWord.letters,
      originalIndex,
    };
  });
}

export function generateWordSearchPuzzle(
  words: readonly string[],
  difficulty: ActivityDifficulty,
  random: () => number = Math.random,
): GeneratedWordSearchPuzzle {
  if (words.length === 0) {
    throw new RangeError(
      "O caça-palavras precisa conter pelo menos uma palavra.",
    );
  }

  const preparedWords = prepareWords(words);
  const gridSizes = getWordSearchGridSizes(
    difficulty,
    words,
  );
  const directions = getWordSearchDirections(difficulty);

  const orderedWords = [...preparedWords].sort(
    (first, second) =>
      second.letters.length - first.letters.length,
  );

  for (const size of gridSizes) {
    for (
      let attempt = 0;
      attempt < MAX_GRID_ATTEMPTS;
      attempt += 1
    ) {
      const grid = createEmptyGrid(size);
      const placements = new Map<number, WordPlacement>();

      let allWordsPlaced = true;

      for (const word of orderedWords) {
        const placement = placeWord(
          grid,
          word,
          directions,
          random,
        );

        if (placement === null) {
          allWordsPlaced = false;
          break;
        }

        placements.set(word.originalIndex, placement);
      }

      if (!allWordsPlaced) {
        continue;
      }

      const wordPositions = preparedWords.map((word) => {
        const placement = placements.get(word.originalIndex);

        if (placement === undefined) {
          throw new Error(
            "Não foi possível recuperar a posição de uma palavra.",
          );
        }

        return {
          word: word.normalized,
          ...placement,
        };
      });

      return {
        grid: fillEmptyCells(grid, random),
        wordPositions,
      };
    }
  }

  throw new WordSearchPlacementError();
}