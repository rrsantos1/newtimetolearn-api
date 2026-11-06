import type { EntityManager } from "typeorm";

export interface IActivityFavoriteRepository {
  isFavorite(userId: string, activityId: string): Promise<boolean>;
  listActivityIdsByUser(userId: string): Promise<string[]>;
  add(manager: EntityManager, userId: string, activityId: string): Promise<void>;
  remove(userId: string, activityId: string): Promise<void>;
}
