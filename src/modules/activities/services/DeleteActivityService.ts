import type { EntityManager } from "typeorm";
import { AppError } from "../../../shared/errors/AppError";
import type { IActivityRepository } from "../repositories/interfaces/IActivityRepository";

interface DeleteActivityInput {
  slug: string;
  teacherId: string;
}

interface DeleteActivityResult {
  id: string;
  slug: string;
  deletedAt: Date;
}

export class DeleteActivityService {
  constructor(
    private readonly manager: EntityManager,
    private readonly activityRepository: IActivityRepository,
  ) {}

  async execute(
    input: DeleteActivityInput,
  ): Promise<DeleteActivityResult> {
    const activity = await this.activityRepository.findBySlug(
      input.slug,
    );

    if (
      !activity ||
      activity.deletedAt !== null ||
      activity.teacherId !== input.teacherId
    ) {
      throw new AppError(
        "ACTIVITY_NOT_FOUND",
        404,
        "Atividade não encontrada.",
      );
    }

    const deletedAt = new Date();

    activity.deletedAt = deletedAt;

    await this.activityRepository.save(this.manager, activity);

    return {
      id: activity.id,
      slug: activity.slug,
      deletedAt,
    };
  }
}