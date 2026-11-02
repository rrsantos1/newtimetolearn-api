import { AppError } from "../../../shared/errors/AppError";
import type { IUserRepository } from "../../users/repositories/interfaces/IUserRepository";
import type { ActivityAttempt } from "../entities/ActivityAttempt";
import type { IActivityRepository } from "../repositories/interfaces/IActivityRepository";
import type { IActivityAttemptRepository } from "../repositories/interfaces/IActivityAttemptRepository";
import { memoryContentSchema } from "../schemas/content/memoryContentSchema";
import { ActivityStatus } from "../types/ActivityStatus";
import { ActivityType } from "../types/ActivityType";
import { ActivityVersionStatus } from "../types/ActivityVersionStatus";

export interface SubmitMemoryAttemptInput {
  slug: string;
  userId: string;
  matchedPairIds: string[];
  wrongAttempts: number;
  elapsedSeconds: number;
}

export interface SubmitMemoryAttemptResult {
  attempt: ActivityAttempt;
  ranking: ActivityAttempt[];
  isInRanking: boolean;
  matchedPairs: number;
  totalPairs: number;
  penaltyPoints: number;
}

export class SubmitMemoryAttemptService {
  constructor(
    private readonly attemptRepository: IActivityAttemptRepository,
    private readonly activityRepository: IActivityRepository,
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(input: SubmitMemoryAttemptInput): Promise<SubmitMemoryAttemptResult> {
    const activity = await this.activityRepository.findBySlugWithVersions(input.slug);
    if (!activity || activity.type !== ActivityType.MEMORY || activity.status !== ActivityStatus.PUBLISHED || !activity.currentPublishedVersionId) {
      throw new AppError("ACTIVITY_NOT_FOUND", 404, "Jogo da memória publicado não encontrado.");
    }

    const version = activity.versions.find((item) => item.id === activity.currentPublishedVersionId && item.status === ActivityVersionStatus.PUBLISHED);
    if (!version) throw new AppError("ACTIVITY_VERSION_NOT_FOUND", 404, "Versão publicada não encontrada.");

    const parsedContent = memoryContentSchema.safeParse(version.content);
    if (!parsedContent.success) throw new AppError("INVALID_ACTIVITY_CONTENT", 422, "O conteúdo deste jogo da memória é inválido.");

    const expectedIds = parsedContent.data.pairs.map((pair) => pair.id);
    const expectedSet = new Set(expectedIds);
    const matchedIds = [...new Set(input.matchedPairIds)].filter((id) => expectedSet.has(id));
    const matchedPairs = matchedIds.length;
    const totalPairs = expectedIds.length;
    const accuracyPoints = Math.round((matchedPairs / totalPairs) * 80);
    const speedPoints = Math.round(Math.max(0, 1 - input.elapsedSeconds / Math.max(1, version.timeLimitSeconds ?? 900)) * 20);
    const penaltyPoints = Math.min(80, input.wrongAttempts * 5);
    const score = Math.max(0, Math.min(100, accuracyPoints + speedPoints - penaltyPoints));
    const user = await this.userRepository.findById(input.userId);
    if (!user) throw new AppError("USER_NOT_FOUND", 404, "Usuário não encontrado.");

    const attempt = await this.attemptRepository.create({
      activityId: activity.id,
      activityVersionId: version.id,
      userId: user.id,
      studentName: user.name,
      wordsFound: matchedIds,
      totalWords: totalPairs,
      elapsedSeconds: input.elapsedSeconds,
      score,
      accuracyPoints,
      speedPoints,
    });
    const ranking = await this.attemptRepository.getRanking(activity.id);
    return {
      attempt,
      ranking,
      isInRanking: ranking.some((entry) => entry.id === attempt.id),
      matchedPairs,
      totalPairs,
      penaltyPoints,
    };
  }
}
