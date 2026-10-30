import { Direction } from "../types";

export interface PlacementReference {
  placementId: number;
  wordIndex: number;
  direction: Direction;
}