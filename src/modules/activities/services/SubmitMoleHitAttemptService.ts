import { AppError } from "../../../shared/errors/AppError";
import type { IUserRepository } from "../../users/repositories/interfaces/IUserRepository";
import type { ActivityAttempt } from "../entities/ActivityAttempt";
import type { IActivityRepository } from "../repositories/interfaces/IActivityRepository";
import type { IActivityAttemptRepository } from "../repositories/interfaces/IActivityAttemptRepository";
import { moleHitContentSchema } from "../schemas/content/moleHitContent.schema";
import { ActivityStatus } from "../types/ActivityStatus";
import { ActivityType } from "../types/ActivityType";
import { ActivityVersionStatus } from "../types/ActivityVersionStatus";

export interface SubmitMoleHitAttemptInput {
  slug: string;
  userId: string;
  hits: number;
  misses: number;
  elapsedSeconds: number;
}

export interface SubmitMoleHitAttemptResult {
  attempt: ActivityAttempt;
  ranking: ActivityAttempt[];
  isInRanking: boolean;
  accuracyPoints: number;
  speedPoints: number;
}

export class SubmitMoleHitAttemptService {
  constructor(
    private readonly attemptRepository: IActivityAttemptRepository,
    private readonly activityRepository: IActivityRepository,
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(input: SubmitMoleHitAttemptInput): Promise<SubmitMoleHitAttemptResult> {
    const activity = await this.activityRepository.findBySlugWithVersions(input.slug);
    if (!activity || activity.type !== ActivityType.MOLE_HIT || activity.status !== ActivityStatus.PUBLISHED || !activity.currentPublishedVersionId) {
      throw new AppError("ACTIVITY_NOT_FOUND", 404, "Atividade publicada não encontrada.");
    }
    const version = activity.versions.find((item) => item.id === activity.currentPublishedVersionId && item.status === ActivityVersionStatus.PUBLISHED);
    if (!version) throw new AppError("ACTIVITY_VERSION_NOT_FOUND", 404, "Versão publicada não encontrada.");
    if (!moleHitContentSchema.safeParse(version.content).success) {
      throw new AppError("INVALID_ACTIVITY_CONTENT", 422, "O conteúdo desta atividade é inválido.");
    }

    const timeLimit = Math.max(1, version.timeLimitSeconds ?? 30);
    const elapsedSeconds = Math.min(input.elapsedSeconds, timeLimit);
    const totalEvents = input.hits + input.misses;
    const accuracyPoints = totalEvents === 0 ? 0 : Math.round((input.hits / totalEvents) * 70);
    const speedPoints = Math.round(Math.max(0, 1 - elapsedSeconds / timeLimit) * 30);
    const score = Math.max(0, Math.min(100, accuracyPoints + speedPoints));
    const user = await this.userRepository.findById(input.userId);
    if (!user) throw new AppError("USER_NOT_FOUND", 404, "Usuário não encontrado.");

    const attempt = await this.attemptRepository.create({
      activityId: activity.id,
      activityVersionId: version.id,
      userId: user.id,
      studentName: user.name,
      wordsFound: [],
      totalWords: totalEvents,
      elapsedSeconds,
      score,
      accuracyPoints,
      speedPoints,
    });
    const ranking = await this.attemptRepository.getRanking(activity.id);
    return { attempt, ranking, isInRanking: ranking.some((entry) => entry.id === attempt.id), accuracyPoints, speedPoints };
  }
}
