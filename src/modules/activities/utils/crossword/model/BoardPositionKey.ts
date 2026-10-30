// model/BoardPositionKey.ts

import { Direction } from "../types";

export class BoardPositionKey {
  constructor(
    private readonly cols: number
  ) {}

  public from(
    row: number,
    col: number,
    direction: Direction
  ): number {
    const directionBit =
      direction === "down"
        ? 1
        : 0;

    return (
      ((row * this.cols) + col) * 2 +
      directionBit
    );
  }
}