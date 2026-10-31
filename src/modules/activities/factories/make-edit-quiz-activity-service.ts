import type { EntityManager } from "typeorm";
import { ActivityRepository } from "../repositories/implementations/ActivityRepository";
import { ActivityVersionRepository } from "../repositories/implementations/ActivityVersionRepository";
import { EditQuizActivityService } from "../services/EditQuizActivityService";

export function makeEditQuizActivityService(manager: EntityManager): EditQuizActivityService {
  return new EditQuizActivityService(
    manager,
    new ActivityRepository(),
    new ActivityVersionRepository(),
  );
}
