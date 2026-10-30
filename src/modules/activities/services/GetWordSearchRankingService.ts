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
      activity.type !== ActivityType.WORD_SEARCH ||
      activity.status !== ActivityStatus.PUBLISHED
    ) {
      throw new AppError("ACTIVITY_NOT_FOUND", 404, "Caça-palavras publicado não encontrado.");
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