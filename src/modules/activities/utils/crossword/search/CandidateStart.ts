import { Direction } from "../types";

export interface CandidateStart {
  row: number;

  col: number;

  direction: Direction;

  intersections: number;

  crossedPlacementIds: readonly number[];
}