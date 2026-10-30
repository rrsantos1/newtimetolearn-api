import { ActivityAttemptRepository } from "../repositories/implementations/ActivityAttemptRepository";
import { ActivityRepository } from "../repositories/implementations/ActivityRepository";
import { GetWordSearchRankingService } from "../services/GetWordSearchRankingService";

export function makeGetWordSearchRankingService(): GetWordSearchRankingService {
  return new GetWordSearchRankingService(
    new ActivityRepository(),
    new ActivityAttemptRepository(),
  );
}