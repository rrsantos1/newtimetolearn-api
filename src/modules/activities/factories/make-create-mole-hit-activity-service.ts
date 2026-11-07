import type { EntityManager } from "typeorm";
import { ActivityRepository } from "../repositories/implementations/ActivityRepository";
import { ActivityVersionRepository } from "../repositories/implementations/ActivityVersionRepository";
import { CreateMoleHitActivityService } from "../services/CreateMoleHitActivityService";

export function makeCreateMoleHitActivityService(manager: EntityManager): CreateMoleHitActivityService {
  return new CreateMoleHitActivityService(manager, new ActivityRepository(), new ActivityVersionRepository());
}
