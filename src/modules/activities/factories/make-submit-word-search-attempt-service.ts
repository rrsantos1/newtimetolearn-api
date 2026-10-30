import { UserRepository } from "../../users/repositories/implementations/UserRepository";
import { ActivityAttemptRepository } from "../repositories/implementations/ActivityAttemptRepository";
import { ActivityRepository } from "../repositories/implementations/ActivityRepository";
import { SubmitWordSearchAttemptService } from "../services/SubmitWordSearchAttemptService";

export function makeSubmitWordSearchAttemptService(): SubmitWordSearchAttemptService {
  return new SubmitWordSearchAttemptService(
    new ActivityAttemptRepository(),
    new ActivityRepository(),
    new UserRepository(),
  );
}
