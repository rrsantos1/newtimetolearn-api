import { AppError } from "../../../shared/errors/AppError";
import type { IActivityRepository } from "../repositories/interfaces/IActivityRepository";
import type { IActivityFavoriteRepository } from "../repositories/interfaces/IActivityFavoriteRepository";
import type { Activity } from "../entities/Activity";
import type { EntityManager } from "typeorm";

export class SetActivityFavoriteService {
  constructor(
    private readonly manager: EntityManager,
    private readonly activityRepository: IActivityRepository,
    private readonly favoriteRepository: IActivityFavoriteRepository,
  ) {}

  async execute(input: { userId: string; slug: string; favorite: boolean }): Promise<{ isFavorite: boolean }> {
    const activity: Activity | null = await this.activityRepository.findBySlug(input.slug);
    if (!activity || activity.deletedAt !== null) {
      throw new AppError("ACTIVITY_NOT_FOUND", 404, "Atividade não encontrada.");
    }

    if (input.favorite) {
      await this.favoriteRepository.add(this.manager, input.userId, activity.id);
    } else {
      await this.favoriteRepository.remove(input.userId, activity.id);
    }

    return { isFavorite: input.favorite };
  }
}
