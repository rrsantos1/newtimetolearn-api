import { ActivityRepository } from "../repositories/implementations/ActivityRepository";
import { ActivityVersionRepository } from "../repositories/implementations/ActivityVersionRepository";
import { GenerateListeningAudioService } from "../services/GenerateListeningAudioService";
import { StorageUsageRepository } from "../../../shared/storage/repositories/StorageUsageRepository";

export function makeGenerateListeningAudioService(): GenerateListeningAudioService {
  return new GenerateListeningAudioService(new ActivityRepository(), new ActivityVersionRepository(), new StorageUsageRepository());
}
