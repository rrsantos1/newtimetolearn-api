import { UserRepository } from "../../users/repositories/implementations/UserRepository";
import { ActivityAttemptRepository } from "../repositories/implementations/ActivityAttemptRepository";
import { ActivityRepository } from "../repositories/implementations/ActivityRepository";
import { SubmitMemoryAttemptService } from "../services/SubmitMemoryAttemptService";

export function makeSubmitMemoryAttemptService(): SubmitMemoryAttemptService {
  return new SubmitMemoryAttemptService(new ActivityAttemptRepository(), new ActivityRepository(), new UserRepository());
}
