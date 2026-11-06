import type { EntityManager } from "typeorm";
import { AppDataSource } from "../../../../shared/database/data-source";
import { ActivityFavorite } from "../../entities/ActivityFavorite";
import type { IActivityFavoriteRepository } from "../interfaces/IActivityFavoriteRepository";

export class ActivityFavoriteRepository implements IActivityFavoriteRepository {
  private readonly repository = AppDataSource.getRepository(ActivityFavorite);

  async isFavorite(userId: string, activityId: string): Promise<boolean> {
    return this.repository.exists({ where: { userId, activityId } });
  }

  async listActivityIdsByUser(userId: string): Promise<string[]> {
    const favorites = await this.repository.find({
      select: { activityId: true },
      where: { userId },
    });
    return favorites.map((favorite) => favorite.activityId);
  }

  async add(manager: EntityManager, userId: string, activityId: string): Promise<void> {
    await manager.getRepository(ActivityFavorite)
      .createQueryBuilder()
      .insert()
      .into(ActivityFavorite)
      .values({ userId, activityId })
      .orIgnore()
      .execute();
  }

  async remove(userId: string, activityId: string): Promise<void> {
    await this.repository.delete({ userId, activityId });
  }
}
