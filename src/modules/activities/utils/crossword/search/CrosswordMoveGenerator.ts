import { Cell } from "../board/Cell";
import { CrosswordBoard } from "../board/CrosswordBoard";
import { CoordinateWalker } from "../board/CoordinateWalker";
import { BoardPositionKey } from "../model/BoardPositionKey";
import {
  CrosswordMove,
  CrosswordWord,
  Direction
} from "../types";

interface IndexedLetter {
  indexes: readonly number[];
  cells: Iterable<Cell>;
}

export class CrosswordMoveGenerator {
  private readonly walker: CoordinateWalker;

  private readonly positionKey: BoardPositionKey;

  constructor(
    private readonly board: CrosswordBoard
  ) {
    this.walker = board.getWalker();

    this.positionKey =
      new BoardPositionKey(
        board.cols
      );
  }

  public generate(
    word: CrosswordWord
  ): CrosswordMove[] {
    const visitedPositions =
      new Set<number>();

    const moves: CrosswordMove[] = [];

    for (const indexedLetter of this.buildLetterIndex(word)) {
      this.generateForLetter(
        word,
        indexedLetter,
        visitedPositions,
        moves
      );
    }
    
    return moves;
  }

  private buildLetterIndex(
    word: CrosswordWord
  ): IndexedLetter[] {
    const grouped =
      new Map<string, number[]>();

    [...word.word].forEach(
      (letter, index) => {
        const indexes =
          grouped.get(letter);

        if (indexes) {
          indexes.push(index);
          return;
        }

        grouped.set(
          letter,
          [index]
        );
      }
    );

    const indexedLetters: IndexedLetter[] = [];

    for (const [letter, indexes] of grouped) {   

      if (!this.board.containsLetter(letter)) {
        continue;
      }

      indexedLetters.push({
        indexes,
        cells:
          this.board.getLetterCells(letter)
      });
    }

    return indexedLetters;
  }

  private generateForLetter(
    word: CrosswordWord,
    indexedLetter: IndexedLetter,
    visitedPositions: Set<number>,
    moves: CrosswordMove[]
  ): void {
    for (const cell of indexedLetter.cells) {
      if (cell.hasDirection("across")) {
        this.createMoves(
          word,
          indexedLetter.indexes,
          cell,
          "down",
          visitedPositions,
          moves
        );
      }

      if (cell.hasDirection("down")) {
        this.createMoves(
          word,
          indexedLetter.indexes,
          cell,
          "across",
          visitedPositions,
          moves
        );
      }
    }
  }

  private createMoves(
    word: CrosswordWord,
    indexes: readonly number[],
    cell: Cell,
    direction: Direction,
    visitedPositions: Set<number>,
    moves: CrosswordMove[]
  ): void {
    for (const wordIndex of indexes) {
      const row =
        direction === "down"
          ? cell.row - wordIndex
          : cell.row;

      const col =
        direction === "across"
          ? cell.col - wordIndex
          : cell.col;

      if (
        !this.walker.fits(
          row,
          col,
          direction,
          word.word.length
        )
      ) {
        continue;
      }

      const key =
        this.positionKey.from(
          row,
          col,
          direction
        );

      const alreadyVisited = visitedPositions.has(key);

      if (alreadyVisited) {  
          continue;
      }

      visitedPositions.add(key);

      moves.push({
          word,
          row,
          col,
          direction
      });
    }
  }
}