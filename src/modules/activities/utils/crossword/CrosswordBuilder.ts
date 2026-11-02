import { CrosswordBoard } from "./board/CrosswordBoard";
import { CrosswordGenerationError } from "../../errors/CrosswordGenerationError";
import { BoardWriter } from "./board/BoardWriter";
import { CrosswordEvaluator } from "./evaluation/CrosswordEvaluator";
import { CrosswordMoveGenerator } from "./search/CrosswordMoveGenerator";
import { CrosswordCandidate, CrosswordMove, CrosswordWord } from "./types";

interface WordCandidateGroup {
  readonly word: CrosswordWord;
  readonly candidates: readonly CrosswordCandidate[];
}

interface SearchBudget {
  exploredCandidates: number;
  readonly maxCandidates: number;
}

const MAX_SEARCH_CANDIDATES = 10000;
const MAX_CANDIDATES_PER_SEED = 1000;
const MAX_CANDIDATES_PER_BOARD = 100;

export class CrosswordBuilder {
  private readonly writer: BoardWriter;
  private readonly generator: CrosswordMoveGenerator;
  private readonly evaluator: CrosswordEvaluator;

  constructor(private readonly board: CrosswordBoard) {
    this.writer = new BoardWriter(board);
    this.generator = new CrosswordMoveGenerator(board);
    this.evaluator = new CrosswordEvaluator(board);
  }

  public build(
    words: readonly CrosswordWord[],
    isValidCompleteBoard?: (board: CrosswordBoard) => boolean,
  ): CrosswordBoard {
    if (words.length === 0) {
      return this.board;
    }

    const initialPlacementCount = this.board.getPlacements().length;
    let totalExploredCandidates = 0;
    const seedWords = [...words].sort(
      (first, second) => second.word.length - first.word.length,
    );

    let result: CrosswordBoard | undefined;

    for (const seedWord of seedWords) {
      const seedIndex = words.indexOf(seedWord);

      if (seedIndex < 0) {
        continue;
      }

      const remainingWords = words.filter((_, index) => index !== seedIndex);
      const orientations: readonly ("across" | "down")[] = ["across", "down"];

      for (const direction of orientations) {
        if (totalExploredCandidates >= MAX_SEARCH_CANDIDATES) {
          break;
        }

        const workingBoard = this.board.clone();
        const workingBuilder = new CrosswordBuilder(workingBoard);

        try {
          workingBuilder.placeSeedWord(seedWord, direction);
        } catch (error: unknown) {
          if (
            error instanceof CrosswordGenerationError &&
            error.code === "INVALID_BOARD"
          ) {
            continue;
          }

          throw error;
        }

        const budget: SearchBudget = {
          exploredCandidates: 0,
          maxCandidates: Math.min(
            MAX_CANDIDATES_PER_SEED,
            MAX_SEARCH_CANDIDATES - totalExploredCandidates,
          ),
        };

        result = workingBuilder.searchRemaining(
          remainingWords,
          budget,
          isValidCompleteBoard,
        );
        totalExploredCandidates += budget.exploredCandidates;

        if (result) {
          break;
        }
      }

      if (result || totalExploredCandidates >= MAX_SEARCH_CANDIDATES) {
        break;
      }
    }

    if (!result) {
      throw new CrosswordGenerationError(
        "Não foi possível posicionar todas as respostas sem violar as regras da grade.",
        "INCOMPLETE_GENERATION",
      );
    }

    for (const placement of result.getPlacements().slice(initialPlacementCount)) {
      this.writer.write({
        word: placement.word,
        row: placement.row,
        col: placement.col,
        direction: placement.direction,
      });
    }

    return this.board;
  }

  private searchRemaining(
    remainingWords: readonly CrosswordWord[],
    budget: SearchBudget,
    isValidCompleteBoard?: (board: CrosswordBoard) => boolean,
  ): CrosswordBoard | undefined {
    if (remainingWords.length === 0) {
      return !isValidCompleteBoard || isValidCompleteBoard(this.board)
        ? this.board
        : undefined;
    }

    if (budget.exploredCandidates >= budget.maxCandidates) {
      return undefined;
    }

    const groups = this.collectCandidates(remainingWords)
      .sort((first, second) => (
        first.candidates.length - second.candidates.length
      ));

    if (groups.length === 0) {
      return undefined;
    }

    let exploredOnBoard = 0;

    for (const group of groups) {
      for (const candidate of group.candidates) {
        if (budget.exploredCandidates >= budget.maxCandidates) {
          return undefined;
        }

        if (exploredOnBoard >= MAX_CANDIDATES_PER_BOARD) {
          break;
        }

        budget.exploredCandidates += 1;
        exploredOnBoard += 1;

        const nextBoard = this.board.clone();
        new BoardWriter(nextBoard).write(candidate.move);

        const nextWords = remainingWords.filter(
          (word) => word !== group.word,
        );

        const result = new CrosswordBuilder(nextBoard).searchRemaining(
          nextWords,
          budget,
          isValidCompleteBoard,
        );

        if (result) {
          return result;
        }
      }
    }

    return undefined;
  }

  private collectCandidates(
    words: readonly CrosswordWord[],
  ): WordCandidateGroup[] {
    const groups: WordCandidateGroup[] = [];

    for (const word of words) {
      const candidates = this.evaluateMoves(
        this.generator.generate(word),
      );

      if (candidates.length > 0) {
        groups.push({ word, candidates });
      }
    }

    return groups;
  }

  private placeSeedWord(
    word: CrosswordWord,
    direction: "across" | "down",
  ): void {
    const isAcross = direction === "across";
    const availableLength = isAcross ? this.board.cols : this.board.rows;

    if (
      word.word.length > availableLength ||
      this.board.rows < 1 ||
      this.board.cols < 1
    ) {
      throw new CrosswordGenerationError(
        `A resposta inicial "${word.word}" não cabe na grade configurada.`,
        "INVALID_BOARD",
      );
    }

    const row = isAcross
      ? Math.floor(this.board.rows / 2)
      : Math.max(0, Math.floor((this.board.rows - word.word.length) / 2));
    const col = isAcross
      ? Math.max(0, Math.floor((this.board.cols - word.word.length) / 2))
      : Math.floor(this.board.cols / 2);

    this.writer.write({ word, row, col, direction });
  }

  private evaluateMoves(
    moves: readonly CrosswordMove[],
  ): CrosswordCandidate[] {
    const candidates: CrosswordCandidate[] = [];

    for (const move of moves) {
      const candidate = this.evaluator.evaluate(move);

      if (candidate) {
        candidates.push(candidate);
      }
    }

    candidates.sort(
      (first, second) => (
        second.metrics.heuristic - first.metrics.heuristic
      ),
    );

    return candidates;
  }
}
