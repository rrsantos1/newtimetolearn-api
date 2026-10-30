import type { EntityManager } from "typeorm";
import { ActivityRepository } from "../repositories/implementations/ActivityRepository";
import { ActivityVersionRepository } from "../repositories/implementations/ActivityVersionRepository";
import { CreateCrosswordActivityService } from "../services/CreateCrosswordActivityService";

export function makeCreateCrosswordActivityService(
  manager: EntityManager,
): CreateCrosswordActivityService {
  return new CreateCrosswordActivityService(
    manager,
    new ActivityRepository(),
    new ActivityVersionRepository(),
  );
}
