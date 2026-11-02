import { AppError } from "../../../shared/errors/AppError";
import { ActivityType } from "../types/ActivityType";
import type { IActivityRepository } from "../repositories/interfaces/IActivityRepository";
import type { IListeningAttemptRepository } from "../repositories/interfaces/IListeningAttemptRepository";

export interface ListListeningAttemptsInput {
  slug: string;
  userId: string;
  isAdmin: boolean;
  page: number;
  limit: number;
}

export interface ListListeningAttemptsResponse {
  items: Array<{
    id: string;
    studentName: string;
    score: number;
    totalBlanks: number;
    correctBlanks: number;
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

export class ListListeningAttemptsService {
  constructor(
    private readonly activityRepository: IActivityRepository,
    private readonly attemptRepository: IListeningAttemptRepository,
  ) {}

  async execute(input: ListListeningAttemptsInput): Promise<ListListeningAttemptsResponse> {
    if (
      !Number.isInteger(input.page) ||
      input.page < 1 ||
      !Number.isInteger(input.limit) ||
      input.limit < 1 ||
      input.limit > 100
    ) {
      throw new AppError("INVALID_PAGINATION", 400, "Os parâmetros de paginação são inválidos.");
    }

    const activity = input.isAdmin
      ? await this.activityRepository.findBySlug(input.slug)
      : await this.activityRepository.findBySlugAndTeacherId(input.slug, input.userId);

    if (!activity || activity.deletedAt || activity.type !== ActivityType.LISTENING) {
      throw new AppError("ACTIVITY_NOT_FOUND", 404, "Atividade de Listening não encontrada.");
    }

    const result = await this.attemptRepository.listByActivity(activity.id, input.page, input.limit);

    return {
      items: result.items.map((attempt) => ({
        id: attempt.id,
        studentName: attempt.studentName,
        score: attempt.score,
        totalBlanks: attempt.totalBlanks,
        correctBlanks: attempt.correctBlanks,
        elapsedSeconds: attempt.elapsedSeconds,
        createdAt: attempt.createdAt,
      })),
      pagination: {
        page: input.page,
        limit: input.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / input.limit),
      },
    };
  }
}
