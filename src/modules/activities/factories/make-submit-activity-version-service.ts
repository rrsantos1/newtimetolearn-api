import type { EntityManager } from "typeorm";
import { ActivityRepository } from "../repositories/implementations/ActivityRepository";
import { ActivityVersionRepository } from "../repositories/implementations/ActivityVersionRepository";
import { SubmitActivityVersionService } from "../services/SubmitActivityVersionService";

export function makeSubmitActivityVersionService(
  manager: EntityManager,
): SubmitActivityVersionService {
  return new SubmitActivityVersionService(
    manager,
    new ActivityRepository(),
    new ActivityVersionRepository(),
  );
}