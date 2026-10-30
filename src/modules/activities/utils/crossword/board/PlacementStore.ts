import { CrosswordPlacement } from "../types";

export class PlacementStore {
  private readonly placements =
    new Map<number, CrosswordPlacement>();

  public add(
    placement: CrosswordPlacement
  ): void {
    this.placements.set(
      placement.id,
      placement
    );
  }

  public remove(
    placementId: number
  ): boolean {
    return this.placements.delete(
      placementId
    );
  }

  public has(
    placementId: number
  ): boolean {
    return this.placements.has(
      placementId
    );
  }

  public get(
    placementId: number
  ): CrosswordPlacement | undefined {
    return this.placements.get(
      placementId
    );
  }

  public ids(): Iterable<number> {
    return this.placements.keys();
  }

  public getAll(): readonly CrosswordPlacement[] {
    return [
        ...this.placements.values()
    ];
  }

  public isEmpty(): boolean {
    return this.placements.size === 0;
  }

  public get size(): number {
    return this.placements.size;
  }

  public clear(): void {
    this.placements.clear();
  }

  public clone(): PlacementStore {
    const clone =
      new PlacementStore();

    for (const placement of this.placements.values()) {
      clone.add({
        ...placement,
        word: {
          ...placement.word
        }
      });
    }

    return clone;
  }
}