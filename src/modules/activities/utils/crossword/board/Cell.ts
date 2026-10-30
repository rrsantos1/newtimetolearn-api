import { PlacementReference } from "../model/PlacementReference";
import { Direction } from "../types";

export class Cell {
  private readonly placements =
    new Map<number, PlacementReference>();

  private readonly directions =
    new Set<Direction>();

  constructor(
    public readonly row: number,
    public readonly col: number,
    public readonly letter: string
  ) {
    if (letter.length !== 1) {
      throw new Error(
        "A cell must contain exactly one letter."
      );
    }
  }

  public addPlacement(
    placement: PlacementReference
  ): void {
    this.placements.set(
      placement.placementId,
      placement
    );

    this.directions.add(
      placement.direction
    );
  }

  public removePlacement(
    placementId: number
  ): void {
    const placement =
      this.placements.get(
        placementId
      );

    if (!placement) {
      return;
    }

    this.placements.delete(
      placementId
    );

    let keepDirection = false;

    for (const current of this.placements.values()) {
      if (
        current.direction ===
        placement.direction
      ) {
        keepDirection = true;
        break;
      }
    }

    if (!keepDirection) {
      this.directions.delete(
        placement.direction
      );
    }
  }

  public hasPlacement(
    placementId: number
  ): boolean {
    return this.placements.has(
      placementId
    );
  }

  public hasDirection(
    direction: Direction
  ): boolean {
    return this.directions.has(
      direction
    );
  }

  public isIntersection(): boolean {
    return this.placements.size > 1;
  }

  public isEmpty(): boolean {
    return this.placements.size === 0;
  }

  public get placementCount(): number {
    return this.placements.size;
  }

  public getPlacementIds(): Iterable<number> {
    return this.placements.keys();
  }

  public getPlacementReferences(): Iterable<PlacementReference> {
    return this.placements.values();
  }

  public clone(): Cell {
    const clone = new Cell(
      this.row,
      this.col,
      this.letter
    );

    for (const placement of this.placements.values()) {
      clone.addPlacement({
        placementId:
          placement.placementId,
        wordIndex:
          placement.wordIndex,
        direction:
          placement.direction
      });
    }

    return clone;
  }
}