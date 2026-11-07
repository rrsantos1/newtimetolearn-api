import type { EntityManager } from "typeorm";
import { ActivityRepository } from "../repositories/implementations/ActivityRepository";
import { ActivityVersionRepository } from "../repositories/implementations/ActivityVersionRepository";
import { EditMoleHitActivityService } from "../services/EditMoleHitActivityService";

export function makeEditMoleHitActivityService(manager: EntityManager): EditMoleHitActivityService {
  return new EditMoleHitActivityService(manager, new ActivityRepository(), new ActivityVersionRepository());
}
