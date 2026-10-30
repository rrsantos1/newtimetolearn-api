import { CrosswordBoard } from "../board/CrosswordBoard";

export interface CrosswordClue {
  readonly number: number;
  readonly clue: string;
  readonly direction: "across" | "down";
  readonly row: number;
  readonly col: number;
  readonly word: string;
}

export interface CrosswordRenderResult {
  readonly grid: string[][];
  readonly clues: readonly CrosswordClue[];
}

export class CrosswordRenderer {
  public render(
    board: CrosswordBoard
  ): CrosswordRenderResult {
    const grid =
      this.buildGrid(board);

    const clues =
      this.buildClues(board);

    return {
      grid,
      clues
    };
  }

  private buildGrid(
    board: CrosswordBoard
  ): string[][] {
    const grid =
      Array.from(
        {
          length: board.rows
        },
        () =>
          Array.from(
            {
              length: board.cols
            },
            () => ""
          )
      );

    for (const placement of board.getPlacements()) {
      let index = 0;

      for (
        const coordinate of board
          .getWalker()
          .walkWord(
            {
              row: placement.row,
              col: placement.col
            },
            placement.direction,
            placement.word.word.length
          )
      ) {
        grid[
          coordinate.row
        ][coordinate.col] =
          placement.word.word[index];

        index++;
      }
    }

    return grid;
  }

  private buildClues(
    board: CrosswordBoard
  ): CrosswordClue[] {
    return board
      .getPlacements()
      .slice()
      .sort(
        (
          first,
          second
        ) =>
          first.number -
          second.number
      )
      .map(
        (
          placement
        ): CrosswordClue => ({
          number:
            placement.number,

          word:
            placement.word.word,

          clue:
            placement.word.clue,

          direction:
            placement.direction,

          row:
            placement.row,

          col:
            placement.col
        })
      );
  }
}