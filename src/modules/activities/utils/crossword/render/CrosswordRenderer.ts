import { CrosswordBoard } from "../board/CrosswordBoard";
import { CrosswordGenerationError } from "../../../errors/CrosswordGenerationError";

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
        const gridRow = grid[coordinate.row];
        const letter = placement.word.word[index];

        if (!gridRow || letter === undefined) {
          throw new CrosswordGenerationError(
            "O gerador retornou uma posição inválida ao montar a grade.",
            "INVALID_PLACEMENT"
          );
        }

        gridRow[coordinate.col] = letter;
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