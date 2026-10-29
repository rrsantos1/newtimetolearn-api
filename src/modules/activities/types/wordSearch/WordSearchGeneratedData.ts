import type {
  WordSearchWordPosition,
} from "../../utils/wordSearch/generateWordSearchPuzzle";

export interface WordSearchGeneratedData {
  grid: string[][];
  wordPositions: WordSearchWordPosition[];
}