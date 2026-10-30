import { CrosswordBoard } from "./board/CrosswordBoard";
import { CrosswordBuilder } from "./CrosswordBuilder";
import { CrosswordWord } from "./types";
import { CrosswordRenderer, CrosswordRenderResult } from "./render/CrosswordRenderer";

export function generateCrosswordPuzzle(
  words: readonly CrosswordWord[],
  rows: number,
  cols: number
): CrosswordRenderResult {
  const board =
    new CrosswordBoard(
      rows,
      cols
    );

  const builder =
    new CrosswordBuilder(
      board
    );

  builder.build(words);

  const renderer =
    new CrosswordRenderer();

  return renderer.render(board);
}