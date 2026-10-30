import { LetterFrequency } from "../model/LetterFrequency";
import { Cell } from "./Cell";

export class LetterStore {
  private readonly letters =
    new Map<string, Set<Cell>>();

  public clear(): void {
    this.letters.clear();
  }

  public register(
    cell: Cell
  ): void {
    let bucket =
      this.letters.get(cell.letter);

    if (!bucket) {
      bucket = new Set<Cell>();

      this.letters.set(
        cell.letter,
        bucket
      );
    }

    bucket.add(cell);
  }

  public unregister(
    cell: Cell
  ): void {
    const bucket =
      this.letters.get(cell.letter);

    if (!bucket) {
      return;
    }

    bucket.delete(cell);

    if (bucket.size === 0) {
      this.letters.delete(cell.letter);
    }
  }

  public contains(
    letter: string
  ): boolean {
    return this.letters.has(letter);
  }

  public getCells(
    letter: string
  ): Iterable<Cell> {
    return (
      this.letters.get(letter) ??
      []
    );
  }

  public frequency(
    letter: string
  ): number {
    return (
      this.letters.get(letter)
        ?.size ?? 0
    );
  }

  public getAvailableLetters(): Iterable<string> {
    return this.letters.keys();
  }

  public getLettersByFrequency(): readonly LetterFrequency[] {
    return [...this.letters.entries()]
      .map(([letter, cells]) => ({
        letter,
        frequency: cells.size
      }))
      .sort(
        (first, second) =>
          first.frequency -
          second.frequency
      );
  }

  public clone(clonedCells: Iterable<Cell>): LetterStore {
    const clone = new LetterStore();

    for (const cell of clonedCells) {
      clone.register(cell);
    }

    return clone;
  }
}