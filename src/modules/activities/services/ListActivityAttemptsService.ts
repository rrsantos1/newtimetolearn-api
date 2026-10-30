import { AppError } from "../../../shared/errors/AppError";
import type { ActivityAttempt } from "../entities/ActivityAttempt";
import type { IActivityRepository } from "../repositories/interfaces/IActivityRepository";
import type { IActivityAttemptRepository } from "../repositories/interfaces/IActivityAttemptRepository";

export interface ListActivityAttemptsInput {
  slug: string;
  userId: string;
  isAdmin: boolean;
  page: number;
  limit: number;
}

export interface ListActivityAttemptsResponse {
  items: Array<{
    id: string;
    studentName: string;
    score: number;
    accuracyPoints: number;
    speedPoints: number;
    totalWords: number;
    wordsFound: string[];
    elapsedSeconds: number;
    createdAt: Date;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function mapAttempt(attempt: ActivityAttempt) {
  return {
    id: attempt.id,
    studentName: attempt.studentName,
    score: attempt.score,
    accuracyPoints: attempt.accuracyPoints,
    speedPoints: attempt.speedPoints,
    totalWords: attempt.totalWords,
    wordsFound: attempt.wordsFound,
    elapsedSeconds: attempt.elapsedSeconds,
    createdAt: attempt.createdAt,
  };
}

export class ListActivityAttemptsService {
  constructor(
    private readonly activityRepository: IActivityRepository,
    private readonly attemptRepository: IActivityAttemptRepository,
  ) {}

  async execute(
    input: ListActivityAttemptsInput,
  ): Promise<ListActivityAttemptsResponse> {
    if (
      !Number.isInteger(input.page) ||
      input.page < 1 ||
      !Number.isInteger(input.limit) ||
      input.limit < 1 ||
      input.limit > 100
    ) {
      throw new AppError(
        "INVALID_PAGINATION",
        400,
        "Os parâmetros de paginação são inválidos.",
      );
    }

    const activity = input.isAdmin
      ? await this.activityRepository.findBySlug(input.slug)
      : await this.activityRepository.findBySlugAndTeacherId(
          input.slug,
          input.userId,
        );

    if (!activity || activity.deletedAt) {
      throw new AppError(
        "ACTIVITY_NOT_FOUND",
        404,
        "Atividade não encontrada.",
      );
    }

    const result = await this.attemptRepository.listByActivity(
      activity.id,
      input.page,
      input.limit,
    );

    return {
      items: result.items.map(mapAttempt),
      pagination: {
        page: input.page,
        limit: input.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / input.limit),
      },
    };
  }
}
