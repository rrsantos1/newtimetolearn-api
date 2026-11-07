import { UserRepository } from "../../users/repositories/implementations/UserRepository";
import { ActivityAttemptRepository } from "../repositories/implementations/ActivityAttemptRepository";
import { ActivityRepository } from "../repositories/implementations/ActivityRepository";
import { SubmitMoleHitAttemptService } from "../services/SubmitMoleHitAttemptService";

export function makeSubmitMoleHitAttemptService(): SubmitMoleHitAttemptService {
  return new SubmitMoleHitAttemptService(new ActivityAttemptRepository(), new ActivityRepository(), new UserRepository());
}
