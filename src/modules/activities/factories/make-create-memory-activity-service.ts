import type { EntityManager } from "typeorm";
import { ActivityRepository } from "../repositories/implementations/ActivityRepository";
import { ActivityVersionRepository } from "../repositories/implementations/ActivityVersionRepository";
import { CreateMemoryActivityService } from "../services/CreateMemoryActivityService";

export function makeCreateMemoryActivityService(manager: EntityManager): CreateMemoryActivityService {
  return new CreateMemoryActivityService(manager, new ActivityRepository(), new ActivityVersionRepository());
}
