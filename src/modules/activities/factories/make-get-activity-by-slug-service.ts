import { ActivityRepository } from "../repositories/implementations/ActivityRepository";
import { GetActivityBySlugService } from "../services/GetActivityBySlugService";

export function makeGetActivityBySlugService(): GetActivityBySlugService {
  return new GetActivityBySlugService(
    new ActivityRepository(),
  );
}