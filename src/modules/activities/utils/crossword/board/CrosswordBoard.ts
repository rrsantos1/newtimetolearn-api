import { Cell } from "./Cell";
import { CellStore } from "./CellStore";
import { CoordinateWalker } from "./CoordinateWalker";
import { LetterStore } from "./LetterStore";
import { PlacementStore } from "./PlacementStore";
import { CellKey } from "../model/CellKey";
import { CrosswordMove, CrosswordPlacement } from "../types";
import { PlacementNumbering } from "../numbering/PlacementNumbering";

export class CrosswordBoard {
  private nextPlacementId = 1;
  private readonly cellStore: CellStore;
  private readonly letterStore: LetterStore;
  private readonly placementStore: PlacementStore;
  private readonly walker: CoordinateWalker;
  public readonly rows: number;
  public readonly cols: number;

  public constructor(
    rows: number,
    cols: number,
    cellStore?: CellStore,
    letterStore?: LetterStore,
    placementStore?: PlacementStore,
    walker?: CoordinateWalker,
    nextPlacementId = 1
  ) {
    this.rows = rows;
    this.cols = cols;

    this.cellStore =
      cellStore ??
      new CellStore(
        new CellKey(cols)
      );

    this.letterStore =
      letterStore ??
      new LetterStore();

    this.placementStore =
      placementStore ??
      new PlacementStore();

    this.walker =
      walker ??
      new CoordinateWalker({
        rows,
        cols
      });

    this.nextPlacementId =
      nextPlacementId;
  }

  private readonly numbering = new PlacementNumbering(this);

  public renumberPlacements(): void {
    this.numbering.renumber();
  }

  // =====================================================
  // Placement
  // =====================================================

  public createPlacementId(): number {
    return this.nextPlacementId++;
  }

  public createPlacement(
    move: CrosswordMove
  ): CrosswordPlacement {
    const placement: CrosswordPlacement = {
      id: this.createPlacementId(),
      number: 0,
      word: move.word,
      row: move.row,
      col: move.col,
      direction: move.direction
    };

    this.placementStore.add(
      placement
    );

    return placement;
  }

  public getPlacement(
    placementId: number
  ): CrosswordPlacement | undefined {
    return this.placementStore.get(
      placementId
    );
  }

  public getPlacements():
    readonly CrosswordPlacement[] {
    return this.placementStore.getAll();
  }

  // =====================================================
  // Cells
  // =====================================================

  public hasCell(
    row: number,
    col: number
  ): boolean {
    return this.cellStore.has(
      row,
      col
    );
  }

  public getCell(
    row: number,
    col: number
  ): Cell | undefined {
    return this.cellStore.get(
      row,
      col
    );
  }

  public getOrCreateCell(
    row: number,
    col: number,
    letter: string
  ): Cell {
    const existing =
      this.getCell(
        row,
        col
      );

    if (existing) {
      return existing;
    }

    const cell =
      new Cell(
        row,
        col,
        letter
      );

    this.cellStore.set(cell);

    this.letterStore.register(
      cell
    );

    return cell;
  }

  // =====================================================
  // Letters
  // =====================================================

  public containsLetter(
    letter: string
  ): boolean {
    return this.letterStore.contains(
      letter
    );
  }

  public getLetterCells(
    letter: string
  ): Iterable<Cell> {
    return this.letterStore.getCells(
      letter
    );
  }

  // =====================================================
  // Walker
  // =====================================================

  public getWalker():
    CoordinateWalker {
    return this.walker;
  }

  // =====================================================
  // Lifecycle
  // =====================================================

  public clear(): void {
    this.nextPlacementId = 1;

    this.cellStore.clear();

    this.letterStore.clear();

    this.placementStore.clear();
  }

  public clone(): CrosswordBoard {
    return new CrosswordBoard(
      this.rows,
      this.cols,

      this.cellStore.clone(),

      this.letterStore.clone(),

      this.placementStore.clone(),

      new CoordinateWalker({
        rows: this.rows,
        cols: this.cols
      }),

      this.nextPlacementId
    );
  }
}