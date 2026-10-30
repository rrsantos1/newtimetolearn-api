import { CellKey } from "../model/CellKey";
import { Cell } from "./Cell";

export class CellStore {
  private readonly cells = new Map<number, Cell>();

  constructor(
    private readonly cellKey: CellKey
  ) {}

  public has(
    row: number,
    col: number
  ): boolean {
    return this.cells.has(
      this.cellKey.from(row, col)
    );
  }

  public get(
    row: number,
    col: number
  ): Cell | undefined {
    return this.cells.get(
      this.cellKey.from(row, col)
    );
  }

  public set(
    cell: Cell
  ): void {
    this.cells.set(
      this.cellKey.from(
        cell.row,
        cell.col
      ),
      cell
    );
  }

  public delete(
    row: number,
    col: number
  ): boolean {
    return this.cells.delete(
      this.cellKey.from(row, col)
    );
  }

  public values(): Iterable<Cell> {
    return this.cells.values();
  }

  public get size(): number {
    return this.cells.size;
  }

  public clear(): void {
    this.cells.clear();
  }

  public clone(): CellStore {
    const clone = new CellStore(
      this.cellKey
    );

    for (const cell of this.cells.values()) {
      clone.set(cell.clone());
    }

    return clone;
  }
}