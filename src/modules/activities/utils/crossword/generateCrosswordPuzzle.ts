import { CrosswordBoard } from "./board/CrosswordBoard";
import { CrosswordBuilder } from "./CrosswordBuilder";
import { CrosswordGenerationError } from "../../errors/CrosswordGenerationError";
import { CrosswordWord } from "./types";
import { CrosswordRenderer, CrosswordRenderResult } from "./render/CrosswordRenderer";
import { validateCrosswordGenerationResult } from "./validateCrosswordGenerationResult";

export function generateCrosswordPuzzle(
  words: readonly CrosswordWord[],
  rows: number,
  cols: number
): CrosswordRenderResult {
  if (
    !Number.isInteger(rows) ||
    !Number.isInteger(cols) ||
    rows < 1 ||
    cols < 1 ||
    rows > 25 ||
    cols > 25
  ) {
    throw new CrosswordGenerationError(
      "As dimensões da grade devem ser inteiras e estar entre 1 e 25.",
      "INVALID_BOARD"
    );
  }

  const board = new CrosswordBoard(rows, cols);
  const builder = new CrosswordBuilder(board);
  builder.build(words);

  const renderer = new CrosswordRenderer();
  const result = renderer.render(board);

  validateCrosswordGenerationResult(
    words.map((word) => word.word),
    result.clues.map((clue) => ({
      word: { word: clue.word },
      row: clue.row,
      col: clue.col,
      direction: clue.direction
    })),
    rows,
    cols
  );

  return result;
}
