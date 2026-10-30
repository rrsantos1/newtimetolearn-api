import { CrosswordMetrics } from "./model/CrosswordMetrics";

export type Direction = "across" | "down";

export interface CrosswordWord {
  word: string;
  clue: string;
}

export interface CrosswordMove {
  word: CrosswordWord;
  row: number;
  col: number;
  direction: Direction;
}

export interface CrosswordPlacement {
  readonly id: number;
  number: number;
  readonly word: CrosswordWord;
  readonly row: number;
  readonly col: number;
  readonly direction: Direction;
}

export interface CrosswordCandidate {
  move: CrosswordMove;
  metrics: CrosswordMetrics;
}

export interface CrosswordBounds {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
}