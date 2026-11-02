import { ActivityRepository } from "../repositories/implementations/ActivityRepository";
import { ListeningAttemptRepository } from "../repositories/implementations/ListeningAttemptRepository";
import { ListListeningAttemptsService } from "../services/ListListeningAttemptsService";

export function makeListListeningAttemptsService(): ListListeningAttemptsService {
  return new ListListeningAttemptsService(new ActivityRepository(), new ListeningAttemptRepository());
}
