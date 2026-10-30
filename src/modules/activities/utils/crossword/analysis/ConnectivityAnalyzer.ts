import { CrosswordBoard } from "../board/CrosswordBoard";

export class ConnectivityAnalyzer {
  private readonly placementComponents =
    new Map<number, number>();

  constructor(
    private readonly board: CrosswordBoard
  ) {}

  private dirty = true;

  public getPlacementComponents():
    ReadonlyMap<number, number> {

        if (this.dirty) {

            this.buildComponentIndex();

            this.dirty = false;

        }

        return this.placementComponents;
  }

  public countComponents(): number {
    return new Set(
      this.getPlacementComponents().values()
    ).size;
  }

  private buildComponentIndex(): void {
    this.placementComponents.clear();

    const visited = new Set<number>();

    let componentId = 0;

    for (const placement of this.board.getPlacements()) {
      if (visited.has(placement.id)) {
        continue;
      }

      this.visit(
        placement.id,
        componentId,
        visited
      );

      componentId++;
    }
  }  

  private visit(
    placementId: number,
    componentId: number,
    visited: Set<number>
  ): void {
    if (visited.has(placementId)) {
      return;
    }

    visited.add(placementId);

    this.placementComponents.set(
      placementId,
      componentId
    );

    const placement =
      this.board.getPlacement(
        placementId
      );

    if (!placement) {
      return;
    }

    const walker =
      this.board.getWalker();

    for (
      const coordinate of walker.walkWord(
        {
          row: placement.row,
          col: placement.col
        },
        placement.direction,
        placement.word.word.length
      )
    ) {
      const cell =
        this.board.getCell(
          coordinate.row,
          coordinate.col
        );

      if (!cell) {
        continue;
      }

      for (const reference of cell.getPlacementReferences()) {
        this.visit(
          reference.placementId,
          componentId,
          visited
        );
      }
    }
  }

  public calculateConnectionGain(
    crossedPlacementIds: readonly number[]
    ): number {
    if (crossedPlacementIds.length < 2) {
        return 0;
    }

    const placementComponents =
        this.getPlacementComponents();

    const connectedComponents =
        new Set<number>();

    for (const placementId of crossedPlacementIds) {
        const componentId =
        placementComponents.get(
            placementId
        );

        if (componentId !== undefined) {
        connectedComponents.add(
            componentId
        );
        }
    }

    if (connectedComponents.size <= 1) {
        return 0;
    }

    return connectedComponents.size - 1;
    }
}