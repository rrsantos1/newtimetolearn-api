import { ActivityFavoriteRepository } from "../repositories/implementations/ActivityFavoriteRepository";
import { ActivityRepository } from "../repositories/implementations/ActivityRepository";
import { SetActivityFavoriteService } from "../services/SetActivityFavoriteService";

export function makeSetActivityFavoriteService(): SetActivityFavoriteService {
  return new SetActivityFavoriteService(new ActivityRepository(), new ActivityFavoriteRepository());
}
