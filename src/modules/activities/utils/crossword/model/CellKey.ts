// model/CellKey.ts

export class CellKey {
  constructor(
    private readonly cols: number
  ) {}

  public from(
    row: number,
    col: number
  ): number {
    return row * this.cols + col;
  }

  public row(
    key: number
  ): number {
    return Math.floor(key / this.cols);
  }

  public col(
    key: number
  ): number {
    return key % this.cols;
  }
}