import type { EntityManager } from "typeorm";
import { ActivityRepository } from "../repositories/implementations/ActivityRepository";
import { ActivityVersionRepository } from "../repositories/implementations/ActivityVersionRepository";
import { ReviewActivityVersionService } from "../services/ReviewActivityVersionService";

export function makeReviewActivityVersionService(
  manager: EntityManager,
): ReviewActivityVersionService {
  return new ReviewActivityVersionService(
    manager,
    new ActivityRepository(),
    new ActivityVersionRepository(),
  );
}