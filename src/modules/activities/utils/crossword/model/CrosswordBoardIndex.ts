import { Direction } from "../types";


interface IndexedPlacement {
  id: number;

  word: string;

  row: number;
  col: number;

  direction: Direction;
}

export interface IndexedCell {
  row: number;
  col: number;

  letter: string;

  placementIds: Set<number>;
}

export interface RankedLetter {
  letter: string;
  frequency: number;
  indexes: number[];
}

export class CrosswordBoardIndex {
  private readonly cells =
    new Map<string, IndexedCell>();

  private readonly letters =
    new Map<string, Set<string>>();

  private readonly placements =
    new Map<number, Set<string>>();

  private readonly frequencies =
    new Map<string, number>();

  // -------------------------------------------------

  private static key(
    row: number,
    col: number
  ): string {
    return `${row}:${col}`;
  }

  // -------------------------------------------------

  public clear(): void {
    this.cells.clear();

    this.letters.clear();

    this.placements.clear();

    this.frequencies.clear();
  }

  // -------------------------------------------------

  public hasCell(
    row: number,
    col: number
  ): boolean {
    return this.cells.has(
      CrosswordBoardIndex.key(
        row,
        col
      )
    );
  }

  public getCell(
    row: number,
    col: number
  ): IndexedCell | undefined {
    return this.cells.get(
      CrosswordBoardIndex.key(
        row,
        col
      )
    );
  }

  // -------------------------------------------------

  public getPlacementCells(
    placementId: number
  ): readonly IndexedCell[] {
    const keys =
      this.placements.get(
        placementId
      );

    if (!keys) {
      return [];
    }

    return [...keys]
      .map(
        (key) =>
          this.cells.get(key)
      )
      .filter(
        (
          cell
        ): cell is IndexedCell =>
          cell !== undefined
      );
  }

  // -------------------------------------------------

  public getLetterCells(
    letter: string
  ): readonly IndexedCell[] {
    const keys =
      this.letters.get(letter);

    if (!keys) {
      return [];
    }

    return [...keys]
      .map(
        (key) =>
          this.cells.get(key)
      )
      .filter(
        (
          cell
        ): cell is IndexedCell =>
          cell !== undefined
      );
  }

  // -------------------------------------------------

  public countLetter(
    letter: string
  ): number {
    return (
      this.frequencies.get(letter)
      ?? 0
    );
  }

  // -------------------------------------------------

  public getLettersByFrequency(
    word: string
  ): RankedLetter[] {
    const grouped =
      new Map<
        string,
        RankedLetter
      >();

    [...word].forEach(
      (
        letter,
        index
      ) => {
        const frequency =
          this.countLetter(
            letter
          );

        if (frequency === 0) {
          return;
        }

        const current =
          grouped.get(letter);

        if (current) {
          current.indexes.push(
            index
          );
          return;
        }

        grouped.set(letter, {
          letter,
          frequency,
          indexes: [index]
        });
      }
    );

    return [...grouped.values()]
      .sort(
        (a, b) =>
          a.frequency -
          b.frequency
      );
  }
}