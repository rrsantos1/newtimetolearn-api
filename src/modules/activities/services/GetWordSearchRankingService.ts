import { AppError } from "../../../shared/errors/AppError";
import type { IActivityRepository } from "../repositories/interfaces/IActivityRepository";
import type { IActivityAttemptRepository } from "../repositories/interfaces/IActivityAttemptRepository";
import { ActivityStatus } from "../types/ActivityStatus";
import { ActivityType } from "../types/ActivityType";

export class GetWordSearchRankingService {
  constructor(
    private readonly activityRepository: IActivityRepository,
    private readonly attemptRepository: IActivityAttemptRepository,
  ) {}

  async execute(slug: string) {
    const activity = await this.activityRepository.findBySlugWithVersions(slug);

    if (
      !activity ||
      ![ActivityType.WORD_SEARCH, ActivityType.CROSSWORD, ActivityType.QUIZ, ActivityType.MEMORY, ActivityType.LISTENING].includes(activity.type) ||
      activity.status !== ActivityStatus.PUBLISHED
    ) {
      throw new AppError("ACTIVITY_NOT_FOUND", 404, "Atividade publicada não encontrada ou sem ranking disponível.");
    }

    const ranking = await this.attemptRepository.getRanking(activity.id);
    return ranking.map((entry, index) => ({
      position: index + 1,
      studentName: entry.studentName,
      score: entry.score,
      elapsedSeconds: entry.elapsedSeconds,
      createdAt: entry.createdAt,
    }));
  }
}