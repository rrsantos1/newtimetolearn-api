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
}

const MAX_SEARCH_CANDIDATES = 2000;
const MAX_CANDIDATES_PER_BOARD = 40;

export class CrosswordBuilder {
  private readonly writer: BoardWriter;
  private readonly generator: CrosswordMoveGenerator;
  private readonly evaluator: CrosswordEvaluator;

  constructor(private readonly board: CrosswordBoard) {
    this.writer = new BoardWriter(board);
    this.generator = new CrosswordMoveGenerator(board);
    this.evaluator = new CrosswordEvaluator(board);
  }

  public build(words: readonly CrosswordWord[]): CrosswordBoard {
    if (words.length === 0) {
      return this.board;
    }

    const remainingWords = [...words];
    const workingBoard = this.board.clone();
    const workingBuilder = new CrosswordBuilder(workingBoard);

    workingBuilder.placeFirstWord(remainingWords);

    const result = workingBuilder.searchRemaining(
      remainingWords,
      { exploredCandidates: 0 },
    );

    if (!result) {
      throw new CrosswordGenerationError(
        "Não foi possível posicionar todas as respostas sem violar as regras da grade.",
        "INCOMPLETE_GENERATION",
      );
    }

    for (const placement of result.getPlacements()) {
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
  ): CrosswordBoard | undefined {
    if (remainingWords.length === 0) {
      return this.board;
    }

    if (budget.exploredCandidates >= MAX_SEARCH_CANDIDATES) {
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
        if (
          budget.exploredCandidates >= MAX_SEARCH_CANDIDATES ||
          exploredOnBoard >= MAX_CANDIDATES_PER_BOARD
        ) {
          return undefined;
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

  private placeFirstWord(remainingWords: CrosswordWord[]): void {
    let longestIndex = 0;

    for (let index = 1; index < remainingWords.length; index += 1) {
      const candidate = remainingWords[index];
      const currentLongest = remainingWords[longestIndex];

      if (
        candidate &&
        currentLongest &&
        candidate.word.length > currentLongest.word.length
      ) {
        longestIndex = index;
      }
    }

    const [firstWord] = remainingWords.splice(longestIndex, 1);

    if (!firstWord) {
      throw new CrosswordGenerationError(
        "Não foi possível selecionar a primeira resposta.",
        "INCOMPLETE_GENERATION",
      );
    }

    if (
      firstWord.word.length > this.board.cols ||
      this.board.rows < 1 ||
      this.board.cols < 1
    ) {
      throw new CrosswordGenerationError(
        `A resposta inicial "${firstWord.word}" não cabe na grade configurada.`,
        "INVALID_BOARD",
      );
    }

    const row = Math.floor(this.board.rows / 2);
    const col = Math.max(
      0,
      Math.floor((this.board.cols - firstWord.word.length) / 2),
    );

    const move: CrosswordMove = {
      word: firstWord,
      row,
      col,
      direction: "across",
    };

    this.writer.write(move);
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
