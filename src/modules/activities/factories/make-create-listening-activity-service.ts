import type { EntityManager } from "typeorm";
import { ActivityRepository } from "../repositories/implementations/ActivityRepository";
import { ActivityVersionRepository } from "../repositories/implementations/ActivityVersionRepository";
import { CreateListeningActivityService } from "../services/CreateListeningActivityService";

export function makeCreateListeningActivityService(manager: EntityManager): CreateListeningActivityService {
  return new CreateListeningActivityService(manager, new ActivityRepository(), new ActivityVersionRepository());
}
