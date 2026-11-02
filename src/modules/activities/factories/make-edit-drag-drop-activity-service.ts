import type { EntityManager } from "typeorm";
import { ActivityRepository } from "../repositories/implementations/ActivityRepository";
import { ActivityVersionRepository } from "../repositories/implementations/ActivityVersionRepository";
import { EditDragDropActivityService } from "../services/EditDragDropActivityService";
import type { DragDropActivityType } from "../services/CreateDragDropActivityService";

export function makeEditDragDropActivityService(manager: EntityManager, activityType: DragDropActivityType): EditDragDropActivityService {
  return new EditDragDropActivityService(manager, new ActivityRepository(), new ActivityVersionRepository(), activityType);
}
