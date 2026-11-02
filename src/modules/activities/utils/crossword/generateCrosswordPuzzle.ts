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
  const renderer = new CrosswordRenderer();
  let validatedResult: CrosswordRenderResult | undefined;

  builder.build(words, (candidateBoard) => {
    try {
      const candidateResult = renderer.render(candidateBoard);
      validateCrosswordGenerationResult(
        words.map((word) => word.word),
        candidateResult.clues.map((clue) => ({
          word: { word: clue.word },
          row: clue.row,
          col: clue.col,
          direction: clue.direction,
        })),
        rows,
        cols,
      );
      validatedResult = candidateResult;
      return true;
    } catch (error: unknown) {
      if (error instanceof CrosswordGenerationError) {
        return false;
      }

      throw error;
    }
  });

  if (!validatedResult) {
    throw new CrosswordGenerationError(
      "Não foi possível gerar uma cruzadinha válida com as respostas informadas. Revise as palavras e tente novamente.",
      "INVALID_PLACEMENT",
    );
  }

  return validatedResult;
}
