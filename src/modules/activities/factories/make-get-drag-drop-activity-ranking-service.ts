import { ActivityAttemptRepository } from "../repositories/implementations/ActivityAttemptRepository";
import { ActivityRepository } from "../repositories/implementations/ActivityRepository";
import { GetDragDropActivityRankingService } from "../services/GetDragDropActivityRankingService";
import type { DragDropActivityType } from "../services/CreateDragDropActivityService";

export function makeGetDragDropActivityRankingService(activityType: DragDropActivityType): GetDragDropActivityRankingService {
  return new GetDragDropActivityRankingService(
    new ActivityRepository(),
    new ActivityAttemptRepository(),
    activityType,
  );
}
