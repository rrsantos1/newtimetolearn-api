import { Direction } from "../types";
import { Coordinate } from "../model/Coordinate";
import { CoordinateSequence } from "../model/CoordinateSequence";

interface CoordinateWalkerOptions {
  rows: number;
  cols: number;
}

const ADJACENT_OFFSETS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1]
] as const;

const DIAGONAL_OFFSETS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1]
] as const;

const NEIGHBOR_OFFSETS = [
  ...ADJACENT_OFFSETS,
  ...DIAGONAL_OFFSETS
] as const;

export class CoordinateWalker {
  constructor(
    private readonly options: CoordinateWalkerOptions
  ) {}

  public isInside(
    row: number,
    col: number
  ): boolean {
    return (
      row >= 0 &&
      row < this.options.rows &&
      col >= 0 &&
      col < this.options.cols
    );
  }

  public move(
    coordinate: Coordinate,
    direction: Direction,
    offset: number
  ): Coordinate | undefined {
    const row =
      direction === "down"
        ? coordinate.row + offset
        : coordinate.row;

    const col =
      direction === "across"
        ? coordinate.col + offset
        : coordinate.col;

    if (!this.isInside(row, col)) {
      return undefined;
    }

    return {
      row,
      col
    };
  }

  public previous(
    coordinate: Coordinate,
    direction: Direction
  ): Coordinate | undefined {
    return this.move(
      coordinate,
      direction,
      -1
    );
  }

  public next(
    coordinate: Coordinate,
    direction: Direction
  ): Coordinate | undefined {
    return this.move(
      coordinate,
      direction,
      1
    );
  }

  public opposite(
    direction: Direction
  ): Direction {
    return direction === "across"
      ? "down"
      : "across";
  }

  public *walk(
    start: Coordinate,
    rowStep: number,
    colStep: number,
    length: number
  ): CoordinateSequence {
    let row = start.row;
    let col = start.col;

    for (let index = 0; index < length; index++) {
      if (!this.isInside(row, col)) {
        return;
      }

      yield {
        row,
        col
      };

      row += rowStep;
      col += colStep;
    }
  }

  public walkWord(
    start: Coordinate,
    direction: Direction,
    length: number
  ): CoordinateSequence {
    return this.walk(
      start,
      direction === "down" ? 1 : 0,
      direction === "across" ? 1 : 0,
      length
    );
  }

  public adjacent(
    coordinate: Coordinate
  ): CoordinateSequence {
    return this.walkOffsets(
      coordinate,
      ADJACENT_OFFSETS
    );
  }

  public diagonal(
    coordinate: Coordinate
  ): CoordinateSequence {
    return this.walkOffsets(
      coordinate,
      DIAGONAL_OFFSETS
    );
  }

  public neighbors(
    coordinate: Coordinate
  ): CoordinateSequence {
    return this.walkOffsets(
      coordinate,
      NEIGHBOR_OFFSETS
    );
  }

  private *walkOffsets(
    coordinate: Coordinate,
    offsets: readonly (readonly [number, number])[]
  ): CoordinateSequence {
    for (const [rowOffset, colOffset] of offsets) {
      const row = coordinate.row + rowOffset;
      const col = coordinate.col + colOffset;

      if (!this.isInside(row, col)) {
        continue;
      }

      yield {
        row,
        col
      };
    }
  }

  public fits(
    row: number,
    col: number,
    direction: Direction,
    length: number
  ): boolean {
    if (direction === "across") {
      return (
        row >= 0 &&
        row < this.options.rows &&
        col >= 0 &&
        col + length <= this.options.cols
      );
    }

    return (
      col >= 0 &&
      col < this.options.cols &&
      row >= 0 &&
      row + length <= this.options.rows
    );
  }
}