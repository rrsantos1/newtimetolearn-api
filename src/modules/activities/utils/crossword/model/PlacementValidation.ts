export interface PlacementValidation {
  valid: boolean;

  intersections: number;

  newLetters: number;

  crossedPlacementIds: readonly number[];

  reason?: string;
}