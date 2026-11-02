import { AppError } from "../../../shared/errors/AppError";
import type { IActivityRepository } from "../repositories/interfaces/IActivityRepository";
import type { IActivityAttemptRepository } from "../repositories/interfaces/IActivityAttemptRepository";
import { ActivityStatus } from "../types/ActivityStatus";
import type { DragDropActivityType } from "./CreateDragDropActivityService";

export class GetDragDropActivityRankingService {
  constructor(
    private readonly activityRepository: IActivityRepository,
    private readonly attemptRepository: IActivityAttemptRepository,
    private readonly activityType: DragDropActivityType,
  ) {}

  async execute(slug: string) {
    const activity = await this.activityRepository.findBySlugWithVersions(slug);
    if (!activity || activity.type !== this.activityType || activity.status !== ActivityStatus.PUBLISHED) {
      throw new AppError("ACTIVITY_NOT_FOUND", 404, "Atividade publicada não encontrada.");
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
