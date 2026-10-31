import type { EntityManager } from "typeorm";
import { ActivityRepository } from "../repositories/implementations/ActivityRepository";
import { ActivityVersionRepository } from "../repositories/implementations/ActivityVersionRepository";
import { CreateQuizActivityService } from "../services/CreateQuizActivityService";

export function makeCreateQuizActivityService(
  manager: EntityManager,
): CreateQuizActivityService {
  return new CreateQuizActivityService(
    manager,
    new ActivityRepository(),
    new ActivityVersionRepository(),
  );
}
