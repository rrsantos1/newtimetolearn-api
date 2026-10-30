import { CrosswordBoard } from "./board/CrosswordBoard";
import { CrosswordGenerationError } from "../../errors/CrosswordGenerationError";
import { BoardWriter } from "./board/BoardWriter";
import { CrosswordEvaluator } from "./evaluation/CrosswordEvaluator";
import { CrosswordMoveGenerator } from "./search/CrosswordMoveGenerator";
import { CrosswordCandidate, CrosswordMove, CrosswordWord } from "./types";

interface WordCandidate {
  readonly word: CrosswordWord;
  readonly candidate: CrosswordCandidate;
}

interface WordCandidateGroup {
  readonly word: CrosswordWord;

  readonly candidates:
    readonly CrosswordCandidate[];
}

interface SimulatedCandidate {
  readonly word: CrosswordWord;
  readonly candidate: CrosswordCandidate;

  readonly survivors: number;

  readonly totalCandidates: number;
}

export class CrosswordBuilder {
  private readonly writer: BoardWriter;
  private readonly generator: CrosswordMoveGenerator;
  private readonly evaluator: CrosswordEvaluator;

  constructor(
    private readonly board: CrosswordBoard
  ) {
    this.writer =
        new BoardWriter(board);
    this.generator =
        new CrosswordMoveGenerator(board);
    this.evaluator =
        new CrosswordEvaluator(board);
  }

  private collectCandidates(
    words: readonly CrosswordWord[]
  ): WordCandidateGroup[] {
    const groups: WordCandidateGroup[] = [];

    for (const word of words) {
      const moves =
        this.generator.generate(word);

      const candidates =
        this.evaluateMoves(moves);

      if (candidates.length === 0) {  
        continue;
      }

      groups.push({
        word,
        candidates
      });
    }

    return groups;
  }

  private selectNextMove(
      groups: readonly WordCandidateGroup[],
      remainingWords: readonly CrosswordWord[]
  ): WordCandidate | undefined {

      const simulations: SimulatedCandidate[] = [];

      const groupsToEvaluate =
          [...groups]
              .sort((a, b) =>
                  a.candidates.length -
                  b.candidates.length
              )
              .slice(0, 3);

      for (const group of groupsToEvaluate) {

          for (const candidate of group.candidates) {

              const result =
                  this.simulateMove(
                      candidate,
                      remainingWords.filter(
                          word => word !== group.word
                      )
                  );

              simulations.push({
                  word: group.word,
                  candidate,
                  survivors: result.survivors,
                  totalCandidates:
                      result.totalCandidates
              });
          }
      }

      simulations.sort((a, b) => {

          if (
              a.survivors !==
              b.survivors
          ) {
              return (
                  b.survivors -
                  a.survivors
              );
          }

          if (
              a.totalCandidates !==
              b.totalCandidates
          ) {
              return (
                  b.totalCandidates -
                  a.totalCandidates
              );
          }

          return (
              b.candidate.metrics.heuristic -
              a.candidate.metrics.heuristic
          );
      });

      const best =
          simulations[0];

      if (!best) {
          return undefined;
      }

      return {
          word: best.word,
          candidate: best.candidate
      };
  }

  private simulateMove(
      candidate: CrosswordCandidate,
      remainingWords: readonly CrosswordWord[]
  ): {
      survivors: number;
      totalCandidates: number;
  } {
      const board =
        this.board.clone();

    const writer =
        new BoardWriter(board);

    writer.write(
        candidate.move
    );

    const generator =
        new CrosswordMoveGenerator(board);

    const evaluator =
        new CrosswordEvaluator(board);

    let survivors = 0;
    let totalCandidates = 0;

    for (const word of remainingWords) {

        const moves =
            generator.generate(word);

        let count = 0;

        for (const move of moves) {

            if (
                evaluator.evaluate(move)
            ) {
                count++;
            }
        }

        if (count > 0) {
            survivors++;
            totalCandidates += count;
        }
    }

    return {
        survivors,
        totalCandidates
    };
  }

  public build(
    words: readonly CrosswordWord[]
  ): CrosswordBoard {
    if (words.length === 0) {
      return this.board;
    }

    const remainingWords: CrosswordWord[] = [
        ...words
    ];

    this.placeFirstWord(
      remainingWords
    );

    while (remainingWords.length > 0) {

        const groups =
            this.collectCandidates(
                remainingWords
            );

        const best =
            this.selectNextMove(
                groups,
                remainingWords
            );

        if (!best) {
            throw new CrosswordGenerationError(
              `Não foi possível posicionar ${remainingWords.length} resposta(s) sem violar as regras da grade.`,
              "INCOMPLETE_GENERATION"
            );
        }

        this.writer.write(
            best.candidate.move
        );

        remainingWords.splice(
            remainingWords.indexOf(best.word),
            1
        );
    }    

    return this.board;
  }

  private placeFirstWord(
    remainingWords: CrosswordWord[]
  ): void {
    let longestIndex = 0;

    for (
      let index = 1;
      index < remainingWords.length;
      index++
    ) {
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

    const [firstWord] =
      remainingWords.splice(
        longestIndex,
        1
      );

    if (!firstWord) {
      throw new CrosswordGenerationError(
        "Não foi possível selecionar a primeira resposta.",
        "INCOMPLETE_GENERATION"
      );
    }

    if (
      firstWord.word.length > this.board.cols ||
      this.board.rows < 1 ||
      this.board.cols < 1
    ) {
      throw new CrosswordGenerationError(
        `A resposta inicial "${firstWord.word}" não cabe na grade configurada.`,
        "INVALID_BOARD"
      );
    }

    const row = Math.floor(this.board.rows / 2);
    const col = Math.max(
      0,
      Math.floor((this.board.cols - firstWord.word.length) / 2)
    );

    const move: CrosswordMove = {
      word: firstWord,
      row,
      col,
      direction: "across"
    };

    this.writer.write(move);
  }

  private evaluateMoves(
      moves: readonly CrosswordMove[]
  ): CrosswordCandidate[] {

      const candidates: CrosswordCandidate[] = [];

      for (const move of moves) {

          const candidate =
              this.evaluator.evaluate(move);

          if (candidate) {
              candidates.push(candidate);
          }
      }

      candidates.sort(
          (a, b) =>
              b.metrics.heuristic -
              a.metrics.heuristic
      );

      return candidates;
  }  
}