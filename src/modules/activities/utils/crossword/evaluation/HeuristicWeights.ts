export interface HeuristicWeights {
  readonly intersection: number;
  readonly crossedWord: number;
  readonly newLetter: number;
  readonly occupiedCell: number;
  readonly centerDistance: number;
  readonly connectionGain: number;
}

export const DEFAULT_HEURISTIC_WEIGHTS: HeuristicWeights = {
  intersection: 12,
  crossedWord: 8,
  newLetter: -2,
  occupiedCell: -1,
  centerDistance: -0.35,
  connectionGain: 20
}

export interface HeuristicBreakdown {
  readonly intersection: number;
  readonly crossedWord: number;
  readonly newLetter: number;
  readonly occupiedCell: number;
  readonly centerDistance: number;
  readonly connectionGain: number;
  readonly total: number;
}