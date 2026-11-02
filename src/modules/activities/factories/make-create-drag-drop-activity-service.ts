import type { EntityManager } from "typeorm";
import { ActivityRepository } from "../repositories/implementations/ActivityRepository";
import { ActivityVersionRepository } from "../repositories/implementations/ActivityVersionRepository";
import { CreateDragDropActivityService, type DragDropActivityType } from "../services/CreateDragDropActivityService";

export function makeCreateDragDropActivityService(
  manager: EntityManager,
  activityType: DragDropActivityType,
): CreateDragDropActivityService {
  return new CreateDragDropActivityService(
    manager,
    new ActivityRepository(),
    new ActivityVersionRepository(),
    activityType,
  );
}
