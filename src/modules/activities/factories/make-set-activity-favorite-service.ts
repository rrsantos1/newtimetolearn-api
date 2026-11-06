import { AppDataSource } from "../../../shared/database/data-source";
import { ActivityFavoriteRepository } from "../repositories/implementations/ActivityFavoriteRepository";
import { ActivityRepository } from "../repositories/implementations/ActivityRepository";
import { SetActivityFavoriteService } from "../services/SetActivityFavoriteService";

export function makeSetActivityFavoriteService(): SetActivityFavoriteService {
  return new SetActivityFavoriteService(
    AppDataSource.manager,
    new ActivityRepository(),
    new ActivityFavoriteRepository(),
  );
}
