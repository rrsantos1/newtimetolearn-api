import { CrosswordBoard } from "../board/CrosswordBoard";
import { Coordinate } from "../model/Coordinate";
import { CrosswordCandidate, CrosswordMove } from "../types";
import { EvaluationState } from "./EvaluationState";
import { ConnectivityAnalyzer } from "./ConnectivityAnalyzer";
import { DEFAULT_HEURISTIC_WEIGHTS, HeuristicWeights } from "./HeuristicWeights";
import { CrosswordMetrics } from "../model/CrosswordMetrics";

export class CrosswordEvaluator {
  private readonly connectivity:
    ConnectivityAnalyzer;

  constructor(
    private readonly board: CrosswordBoard,
    private readonly weights:
      HeuristicWeights =
        DEFAULT_HEURISTIC_WEIGHTS
  ) {
    this.connectivity =
      new ConnectivityAnalyzer(
        board
      );
  }

  public evaluate(
    move: CrosswordMove
  ): CrosswordCandidate | null {
    const state =
      new EvaluationState(
        this.board.getPlacements().length === 0
      );

    this.validatePlacement(
      move,
      state
    );

    if (!state.isValid()) {
      return null;
    }

    const metrics =
      state.buildMetrics(
        this.board.rows,
        this.board.cols
      );

    const connectionGain =
      this.connectivity
        .calculateConnectionGain(
          metrics.crossedPlacementIds
        );

    metrics.heuristic =
      this.calculateHeuristic(
        metrics,
        connectionGain
      );

    return {
      move,
      metrics
    };
  }

  private validatePlacement(
    move: CrosswordMove,
    state: EvaluationState
  ): void {
    if (!this.validateBounds(move)) {
      state.invalidate();
      return;
    }

    let wordIndex = 0;

    for (
      const coordinate of this.board
        .getWalker()
        .walkWord(
          {
            row: move.row,
            col: move.col
          },
          move.direction,
          move.word.word.length
        )
    ) {
      if (
        !this.validateLetter(
          move,
          coordinate,
          wordIndex,
          state
        )
      ) {
        state.invalidate();
        return;
      }

      if (
        !this.validateAdjacentCells(
          move,
          coordinate,
          wordIndex
        )
      ) {
        state.invalidate();
        return;
      }

      wordIndex++;
    }

    if (!this.validateWordBoundaries(move)) {
      state.invalidate();
      return;
    }

    if (!this.validateFirstPlacementRule(state)) {
      state.invalidate();
    }
  }

  private validateBounds(
    move: CrosswordMove
  ): boolean {
    return this.board
      .getWalker()
      .fits(
        move.row,
        move.col,
        move.direction,
        move.word.word.length
      );
  }

  private validateLetter(
    move: CrosswordMove,
    coordinate: Coordinate,
    wordIndex: number,
    state: EvaluationState
  ): boolean {
    state.addVisitedCell(
      coordinate.row,
      coordinate.col
    );

    const boardCell =
      this.board.getCell(
        coordinate.row,
        coordinate.col
      );

    const letter =
      move.word.word[wordIndex];

    if (!boardCell) {
      state.addNewLetter();
      return true;
    }

    if (boardCell.letter !== letter) {
      return false;
    }

    state.addIntersection();

    for (
      const placementId of
      boardCell.getPlacementIds()
    ) {
      state.addCrossedPlacement(
        placementId
      );
    }

    return true;
  }

  private validateAdjacentCells(
    move: CrosswordMove,
    coordinate: Coordinate,
    wordIndex: number
  ): boolean {
    const boardCell =
      this.board.getCell(
        coordinate.row,
        coordinate.col
      );

    // Se a letra já existe no tabuleiro, trata-se
    // de uma interseção e as adjacências laterais
    // são permitidas.
    if (boardCell) {
      return true;
    }

    const walker =
      this.board.getWalker();

    if (move.direction === "across") {
      const up =
        walker.move(
          coordinate,
          "down",
          -1
        );

      if (
        up &&
        this.board.getCell(
          up.row,
          up.col
        )
      ) {
        return false;
      }

      const down =
        walker.move(
          coordinate,
          "down",
          1
        );

      if (
        down &&
        this.board.getCell(
          down.row,
          down.col
        )
      ) {
        return false;
      }

      return true;
    }

    const left =
      walker.move(
        coordinate,
        "across",
        -1
      );

    if (
      left &&
      this.board.getCell(
        left.row,
        left.col
      )
    ) {
      return false;
    }

    const right =
      walker.move(
        coordinate,
        "across",
        1
      );

    if (
      right &&
      this.board.getCell(
        right.row,
        right.col
      )
    ) {
      return false;
    }

    return true;
  }

  private validateWordBoundaries(
    move: CrosswordMove
  ): boolean {
    const walker =
      this.board.getWalker();

    const start: Coordinate = {
      row: move.row,
      col: move.col
    };

    const before =
      walker.previous(
        start,
        move.direction
      );

    if (
      before &&
      this.board.getCell(
        before.row,
        before.col
      )
    ) {
      return false;
    }

    const end: Coordinate =
      move.direction === "across"
        ? {
            row: move.row,
            col:
              move.col +
              move.word.word.length -
              1
          }
        : {
            row:
              move.row +
              move.word.word.length -
              1,
            col: move.col
          };

    const after =
      walker.next(
        end,
        move.direction
      );

    if (
      after &&
      this.board.getCell(
        after.row,
        after.col
      )
    ) {
      return false;
    }

    return true;
  }

  private validateFirstPlacementRule(
    state: EvaluationState
  ): boolean {
    return (
      state.isFirstPlacement ||
      state.hasIntersections()
    );
  }
  
  private calculateHeuristic(
    metrics: CrosswordMetrics,
    connectionGain: number
  ): number {
    const weights =
      this.weights;

    return (
      metrics.intersections *
        weights.intersection +

      metrics.crossedPlacementIds.length *
        weights.crossedWord +

      connectionGain *
        weights.connectionGain +

      metrics.newLetters *
        weights.newLetter +

      metrics.occupiedCells *
        weights.occupiedCell +

      metrics.centerDistance *
        weights.centerDistance
    );
  }
}