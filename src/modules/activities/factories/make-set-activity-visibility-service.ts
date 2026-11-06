import { AppDataSource } from "../../../shared/database/data-source";
import { ActivityRepository } from "../repositories/implementations/ActivityRepository";
import { SetActivityVisibilityService } from "../services/SetActivityVisibilityService";

export function makeSetActivityVisibilityService(): SetActivityVisibilityService {
  return new SetActivityVisibilityService(AppDataSource.manager, new ActivityRepository());
}
