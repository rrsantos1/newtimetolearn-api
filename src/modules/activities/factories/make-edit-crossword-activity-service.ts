import type { EntityManager } from "typeorm";
import { ActivityRepository } from "../repositories/implementations/ActivityRepository";
import { ActivityVersionRepository } from "../repositories/implementations/ActivityVersionRepository";
import { EditCrosswordActivityService } from "../services/EditCrosswordActivityService";

export function makeEditCrosswordActivityService(
  manager: EntityManager,
): EditCrosswordActivityService {
  return new EditCrosswordActivityService(
    manager,
    new ActivityRepository(),
    new ActivityVersionRepository(),
  );
}
