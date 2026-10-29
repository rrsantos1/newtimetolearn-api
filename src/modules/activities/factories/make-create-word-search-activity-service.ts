import type { EntityManager } from "typeorm";
import { ActivityRepository } from "../repositories/implementations/ActivityRepository";
import { ActivityVersionRepository } from "../repositories/implementations/ActivityVersionRepository";
import { CreateWordSearchActivityService } from "../services/CreateWordSearchActivityService";

export function makeCreateWordSearchActivityService(
  manager: EntityManager,
): CreateWordSearchActivityService {
  return new CreateWordSearchActivityService(
    manager,
    new ActivityRepository(),
    new ActivityVersionRepository(),
  );
}