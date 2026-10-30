export interface CrosswordMetrics {
  intersections: number;
  newLetters: number;
  occupiedCells: number;
  crossedPlacementIds: readonly number[];
  centerDistance: number;
  heuristic: number;
}