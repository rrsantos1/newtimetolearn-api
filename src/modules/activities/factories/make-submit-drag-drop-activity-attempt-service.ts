import { UserRepository } from "../../users/repositories/implementations/UserRepository";
import { ActivityAttemptRepository } from "../repositories/implementations/ActivityAttemptRepository";
import { ActivityRepository } from "../repositories/implementations/ActivityRepository";
import { SubmitDragDropActivityAttemptService } from "../services/SubmitDragDropActivityAttemptService";
import type { DragDropActivityType } from "../services/CreateDragDropActivityService";

export function makeSubmitDragDropActivityAttemptService(activityType: DragDropActivityType): SubmitDragDropActivityAttemptService {
  return new SubmitDragDropActivityAttemptService(
    new ActivityAttemptRepository(),
    new ActivityRepository(),
    new UserRepository(),
    activityType,
  );
}
