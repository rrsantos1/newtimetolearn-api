import type { EntityManager } from "typeorm";
import { ActivityRepository } from "../repositories/implementations/ActivityRepository";
import { ActivityVersionRepository } from "../repositories/implementations/ActivityVersionRepository";
import { ApproveActivityVersionService } from "../services/ApproveActivityVersionService";

export function makeApproveActivityVersionService(
  manager: EntityManager,
): ApproveActivityVersionService {
  return new ApproveActivityVersionService(
    manager,
    new ActivityRepository(),
    new ActivityVersionRepository(),
  );
}