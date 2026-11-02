import type { EntityManager } from "typeorm";
import { ActivityRepository } from "../repositories/implementations/ActivityRepository";
import { ActivityVersionRepository } from "../repositories/implementations/ActivityVersionRepository";
import { EditListeningActivityService } from "../services/EditListeningActivityService";

export function makeEditListeningActivityService(manager: EntityManager): EditListeningActivityService {
  return new EditListeningActivityService(manager, new ActivityRepository(), new ActivityVersionRepository());
}
