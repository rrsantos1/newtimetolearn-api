import type { EntityManager } from "typeorm";
import { ActivityRepository } from "../repositories/implementations/ActivityRepository";
import { ActivityVersionRepository } from "../repositories/implementations/ActivityVersionRepository";
import { EditWordSearchActivityService } from "../services/EditWordSearchActivityService";

export function makeEditWordSearchActivityService(
  manager: EntityManager,
): EditWordSearchActivityService {
  return new EditWordSearchActivityService(
    manager,
    new ActivityRepository(),
    new ActivityVersionRepository(),
  );
}