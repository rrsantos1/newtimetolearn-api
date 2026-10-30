export interface EvaluationResult {
  valid: boolean;
  intersections: number;
  newLetters: number;
  occupiedCells: number;
  crossedPlacementIds: readonly number[];
  score: number;
}