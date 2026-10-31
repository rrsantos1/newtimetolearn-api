import { MediaAssetRepository } from "../repositories/implementations/MediaAssetRepository";
import { CreateMediaAssetService, ListMediaAssetsService } from "../services/MediaAssetService";

export function makeCreateMediaAssetService(): CreateMediaAssetService {
  return new CreateMediaAssetService(new MediaAssetRepository());
}
export function makeListMediaAssetsService(): ListMediaAssetsService {
  return new ListMediaAssetsService(new MediaAssetRepository());
}
