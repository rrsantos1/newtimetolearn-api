import type { EntityManager } from "typeorm";
import { ActivityRepository } from "../repositories/implementations/ActivityRepository";
import { DeleteActivityService } from "../services/DeleteActivityService";

export function makeDeleteActivityService(
  manager: EntityManager,
): DeleteActivityService {
  return new DeleteActivityService(
    manager,
    new ActivityRepository(),
  );
}