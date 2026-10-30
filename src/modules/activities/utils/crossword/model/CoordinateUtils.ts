import { Coordinate } from "./Coordinate";

export class CoordinateUtils {
  private constructor() {}

  public static equals(
    first: Coordinate,
    second: Coordinate
  ): boolean {
    return (
      first.row === second.row &&
      first.col === second.col
    );
  }

  public static translate(
    coordinate: Coordinate,
    rowOffset: number,
    colOffset: number
  ): Coordinate {
    return {
      row: coordinate.row + rowOffset,
      col: coordinate.col + colOffset
    };
  }

  public static manhattanDistance(
    first: Coordinate,
    second: Coordinate
  ): number {
    return (
      Math.abs(first.row - second.row) +
      Math.abs(first.col - second.col)
    );
  }

  public static chebyshevDistance(
    first: Coordinate,
    second: Coordinate
  ): number {
    return Math.max(
      Math.abs(first.row - second.row),
      Math.abs(first.col - second.col)
    );
  }
}