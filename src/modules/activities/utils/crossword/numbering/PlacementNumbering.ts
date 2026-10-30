import { CrosswordBoard } from "../board/CrosswordBoard";

export class PlacementNumbering {
  constructor(
    private readonly board: CrosswordBoard
  ) {}

  public renumber(): void {
    let number = 1;

    const starts =
      new Map<string, number>();

    const placements =
      this.board
        .getPlacements()
        .slice()
        .sort(
          (first, second) =>
            first.row === second.row
              ? first.col - second.col
              : first.row - second.row
        );

    for (const placement of placements) {
      const key =
        `${placement.row}:${placement.col}`;

      const existing =
        starts.get(key);

      if (existing !== undefined) {
        placement.number = existing;
        continue;
      }

      placement.number = number;

      starts.set(
        key,
        number
      );

      number++;
    }
  }
}