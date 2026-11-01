import { MediaAssetRepository } from "../repositories/implementations/MediaAssetRepository";
import { CreateMediaAssetService, ListMediaAssetsService, ReviewMediaAssetService, ListPendingMediaAssetsService, GetQuarantinedMediaAssetService } from "../services/MediaAssetService";

export function makeCreateMediaAssetService(): CreateMediaAssetService {
  return new CreateMediaAssetService(new MediaAssetRepository());
}
export function makeListMediaAssetsService(): ListMediaAssetsService {
  return new ListMediaAssetsService(new MediaAssetRepository());
}
export function makeListPendingMediaAssetsService(): ListPendingMediaAssetsService {
  return new ListPendingMediaAssetsService(new MediaAssetRepository());
}
export function makeReviewMediaAssetService(): ReviewMediaAssetService {
  return new ReviewMediaAssetService(new MediaAssetRepository());
}

export function makeGetQuarantinedMediaAssetService(): GetQuarantinedMediaAssetService {
  return new GetQuarantinedMediaAssetService(new MediaAssetRepository());
}
