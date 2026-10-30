import { CrosswordMetrics } from "../model/CrosswordMetrics";

export class EvaluationState {
  private intersections = 0;

  private newLetters = 0;

  private occupiedCells = 0;

  private rowSum = 0;

  private colSum = 0;

  private readonly crossedPlacementIds =
    new Set<number>();

  private valid = true;

  constructor(
    public readonly isFirstPlacement: boolean
  ) {}

  public addVisitedCell(
    row: number,
    col: number
  ): void {
    this.rowSum += row;
    this.colSum += col;
    this.occupiedCells++;
  }

  public addIntersection(): void {
    this.intersections++;
  }

  public addCrossedPlacement(
    placementId: number
  ): void {
    this.crossedPlacementIds.add(
      placementId
    );
  }

  public addNewLetter(): void {
    this.newLetters++;
  }

  public invalidate(): void {
    this.valid = false;
  }

  public isValid(): boolean {
    return this.valid;
  }

  public buildMetrics(
    rows: number,
    cols: number
  ): CrosswordMetrics {
    const averageRow =
      this.rowSum /
      this.occupiedCells;

    const averageCol =
      this.colSum /
      this.occupiedCells;

    return {
      intersections:
        this.intersections,

      newLetters:
        this.newLetters,

      occupiedCells:
        this.occupiedCells,

      crossedPlacementIds:
        [...this.crossedPlacementIds],

      centerDistance:
        Math.abs(
          averageRow - rows / 2
        ) +
        Math.abs(
          averageCol - cols / 2
        ),

      heuristic: 0
    };
  }

  public hasIntersections(): boolean {
    return this.intersections > 0;
  }
}