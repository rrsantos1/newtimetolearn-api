import { ActivityCoverGenerationJobRepository } from "../repositories/implementations/ActivityCoverGenerationJobRepository";

export function makeActivityCoverGenerationJobRepository(): ActivityCoverGenerationJobRepository {
  return new ActivityCoverGenerationJobRepository();
}
