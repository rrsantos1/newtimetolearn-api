import { AppError } from "../../../shared/errors/AppError";
import type { IUserRepository } from "../../users/repositories/interfaces/IUserRepository";
import type { ActivityAttempt } from "../entities/ActivityAttempt";
import type { IActivityRepository } from "../repositories/interfaces/IActivityRepository";
import type { IActivityAttemptRepository } from "../repositories/interfaces/IActivityAttemptRepository";
import { ActivityStatus } from "../types/ActivityStatus";
import { ActivityType } from "../types/ActivityType";
import { ActivityVersionStatus } from "../types/ActivityVersionStatus";

export interface SubmitWordSearchAttemptInput {
  slug: string;
  userId: string;
  wordsFound: string[];
  elapsedSeconds: number;
}

export interface SubmitWordSearchAttemptResult {
  attempt: ActivityAttempt;
  ranking: ActivityAttempt[];
  isInRanking: boolean;
}

function normalizeWord(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s-]/g, "").toUpperCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class SubmitWordSearchAttemptService {
  constructor(
    private readonly attemptRepository: IActivityAttemptRepository,
    private readonly activityRepository: IActivityRepository,
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(input: SubmitWordSearchAttemptInput): Promise<SubmitWordSearchAttemptResult> {
    const activity = await this.activityRepository.findBySlugWithVersions(input.slug);

    if (
      !activity ||
      (activity.type !== ActivityType.WORD_SEARCH && activity.type !== ActivityType.CROSSWORD) ||
      activity.status !== ActivityStatus.PUBLISHED ||
      !activity.currentPublishedVersionId
    ) {
      throw new AppError("ACTIVITY_NOT_FOUND", 404, "Atividade publicada não encontrada.");
    }

    const version = activity.versions.find(
      (item) => item.id === activity.currentPublishedVersionId && item.status === ActivityVersionStatus.PUBLISHED,
    );
    if (!version) {
      throw new AppError("ACTIVITY_VERSION_NOT_FOUND", 404, "Versão publicada não encontrada.");
    }

    let expectedWords: string[];
    if (activity.type === ActivityType.WORD_SEARCH) {
      const contentWords = version.content.words;
      if (!Array.isArray(contentWords) || !contentWords.every((word): word is string => typeof word === "string") || contentWords.length === 0) {
        throw new AppError("INVALID_ACTIVITY_CONTENT", 422, "A lista de palavras desta atividade é inválida.");
      }
      expectedWords = contentWords.map(normalizeWord);
    } else {
      const generatedData = version.generatedData;
      const rawClues = isRecord(generatedData) ? generatedData.clues : null;
      if (!Array.isArray(rawClues) || rawClues.length === 0) {
        throw new AppError("INVALID_ACTIVITY_CONTENT", 422, "As pistas desta cruzadinha são inválidas.");
      }
      const clueWords = rawClues.flatMap((clue): string[] => {
        if (!isRecord(clue) || typeof clue.word !== "string") return [];
        return [normalizeWord(clue.word)];
      });
      if (clueWords.length !== rawClues.length) {
        throw new AppError("INVALID_ACTIVITY_CONTENT", 422, "O gabarito desta cruzadinha é inválido.");
      }
      expectedWords = clueWords;
    }

    const normalizedExpectedWords = activity.type === ActivityType.WORD_SEARCH
      ? [...new Set(expectedWords)]
      : expectedWords;
    const normalizedFoundWords = input.wordsFound.map(normalizeWord).filter(Boolean);
    const answersToMatch = activity.type === ActivityType.WORD_SEARCH
      ? [...new Set(normalizedFoundWords)]
      : normalizedFoundWords;
    const remainingExpectedWords = [...normalizedExpectedWords];
    const validFoundWords = answersToMatch.flatMap((word) => {
      const matchingIndex = remainingExpectedWords.indexOf(word);
      if (matchingIndex < 0) return [];
      remainingExpectedWords.splice(matchingIndex, 1);
      return [word];
    });

    const elapsedSeconds = Math.max(0, Math.floor(input.elapsedSeconds));
    const timeLimitSeconds = Math.max(1, version.timeLimitSeconds ?? 900);
    const accuracyPoints = Math.round((validFoundWords.length / normalizedExpectedWords.length) * 80);
    const speedPoints = Math.round(Math.max(0, 1 - elapsedSeconds / timeLimitSeconds) * 20);
    const score = Math.min(100, accuracyPoints + speedPoints);
    const user = await this.userRepository.findById(input.userId);

    if (!user) {
      throw new AppError("USER_NOT_FOUND", 404, "Usuário não encontrado.");
    }

    const attempt = await this.attemptRepository.create({
      activityId: activity.id,
      activityVersionId: version.id,
      userId: user.id,
      studentName: user.name,
      wordsFound: validFoundWords,
      totalWords: normalizedExpectedWords.length,
      elapsedSeconds,
      score,
      accuracyPoints,
      speedPoints,
    });

    const ranking = await this.attemptRepository.getRanking(activity.id);
    return {
      attempt,
      ranking,
      isInRanking: ranking.some((entry) => entry.id === attempt.id),
    };
  }
}