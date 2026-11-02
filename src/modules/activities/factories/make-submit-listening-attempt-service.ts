import { UserRepository } from "../../users/repositories/implementations/UserRepository";
import { ActivityRepository } from "../repositories/implementations/ActivityRepository";
import { ListeningAttemptRepository } from "../repositories/implementations/ListeningAttemptRepository";
import { SubmitListeningAttemptService } from "../services/SubmitListeningAttemptService";

export function makeSubmitListeningAttemptService(): SubmitListeningAttemptService {
  return new SubmitListeningAttemptService(
    new ListeningAttemptRepository(),
    new ActivityRepository(),
    new UserRepository(),
  );
}
