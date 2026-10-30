import { ActivityAttemptRepository } from "../repositories/implementations/ActivityAttemptRepository";
import { SubmitWordSearchAttemptService } from "../services/SubmitWordSearchAttemptService";

export function makeSubmitWordSearchAttemptService(): SubmitWordSearchAttemptService {
  return new SubmitWordSearchAttemptService(new ActivityAttemptRepository());
}
