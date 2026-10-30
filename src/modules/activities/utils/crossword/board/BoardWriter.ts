import { CrosswordBoard } from "./CrosswordBoard";
import {
  CrosswordMove,
  CrosswordPlacement
} from "../types";

export class BoardWriter {
  constructor(
    private readonly board: CrosswordBoard
  ) {}

  public write(
    move: CrosswordMove
  ): CrosswordPlacement {
    const placement = this.board.createPlacement(move);
    let wordIndex = 0;

    for (
      const coordinate of this.board
        .getWalker()
        .walkWord(
          {
            row: move.row,
            col: move.col
          },
          move.direction,
          move.word.word.length
        )
    ) {
      const letter = move.word.word[wordIndex];

      if (letter === undefined) {
        throw new Error(
          `Invalid word index ${wordIndex} while writing crossword placement.`
        );
      }

      const cell = this.board.getOrCreateCell(
        coordinate.row,
        coordinate.col,
        letter
      );

      cell.addPlacement({
        placementId: placement.id,
        wordIndex,
        direction: placement.direction
      });

      wordIndex++;
    }

    this.board.renumberPlacements();

    return placement;
  }
}