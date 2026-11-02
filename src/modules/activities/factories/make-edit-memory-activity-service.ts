import type { EntityManager } from "typeorm";
import { ActivityRepository } from "../repositories/implementations/ActivityRepository";
import { ActivityVersionRepository } from "../repositories/implementations/ActivityVersionRepository";
import { EditMemoryActivityService } from "../services/EditMemoryActivityService";

export function makeEditMemoryActivityService(manager: EntityManager): EditMemoryActivityService {
  return new EditMemoryActivityService(manager, new ActivityRepository(), new ActivityVersionRepository());
}
