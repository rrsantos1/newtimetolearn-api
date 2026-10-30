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
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]/g, "")
    .toUpperCase();
}

export class SubmitWordSearchAttemptService {
  constructor(
    private readonly attemptRepository: IActivityAttemptRepository,
    private readonly activityRepository: IActivityRepository,
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(
    input: SubmitWordSearchAttemptInput,
  ): Promise<SubmitWordSearchAttemptResult> {
    const activity = await this.activityRepository.findBySlugWithVersions(input.slug);

    if (
      !activity ||
      activity.type !== ActivityType.WORD_SEARCH ||
      activity.status !== ActivityStatus.PUBLISHED ||
      !activity.currentPublishedVersionId
    ) {
      throw new AppError("ACTIVITY_NOT_FOUND", 404, "Atividade publicada não encontrada.");
    }

    const version = activity.versions.find(
      (item) =>
        item.id === activity.currentPublishedVersionId &&
        item.status === ActivityVersionStatus.PUBLISHED,
    );

    if (!version) {
      throw new AppError("ACTIVITY_VERSION_NOT_FOUND", 404, "Versão publicada não encontrada.");
    }

    const contentWords = version.content.words;
    if (
      !Array.isArray(contentWords) ||
      !contentWords.every((word): word is string => typeof word === "string") ||
      contentWords.length === 0
    ) {
      throw new AppError("INVALID_ACTIVITY_CONTENT", 422, "A lista de palavras desta atividade é inválida.");
    }

    const normalizedWords = [...new Set(contentWords.map(normalizeWord))];
    const normalizedFoundWords = [...new Set(input.wordsFound.map(normalizeWord))];
    const validFoundWords = normalizedFoundWords.filter((word) =>
      normalizedWords.includes(word),
    );

    const elapsedSeconds = Math.max(0, Math.floor(input.elapsedSeconds));
    const timeLimitSeconds = Math.max(1, version.timeLimitSeconds ?? 900);
    const accuracyPoints = Math.round((validFoundWords.length / normalizedWords.length) * 80);
    const speedPoints = Math.round(
      Math.max(0, 1 - elapsedSeconds / timeLimitSeconds) * 20,
    );
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
      totalWords: normalizedWords.length,
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
