import { ActivityRepository } from "../repositories/implementations/ActivityRepository";
import { ActivityVersionRepository } from "../repositories/implementations/ActivityVersionRepository";
import { GenerateListeningAudioService } from "../services/GenerateListeningAudioService";

export function makeGenerateListeningAudioService(): GenerateListeningAudioService {
  return new GenerateListeningAudioService(new ActivityRepository(), new ActivityVersionRepository());
}
