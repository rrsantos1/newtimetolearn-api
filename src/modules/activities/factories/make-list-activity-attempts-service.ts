import { ActivityAttemptRepository } from "../repositories/implementations/ActivityAttemptRepository";
import { ActivityRepository } from "../repositories/implementations/ActivityRepository";
import { ListActivityAttemptsService } from "../services/ListActivityAttemptsService";

export function makeListActivityAttemptsService(): ListActivityAttemptsService {
  return new ListActivityAttemptsService(
    new ActivityRepository(),
    new ActivityAttemptRepository(),
  );
}
