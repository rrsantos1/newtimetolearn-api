import { MediaAssetRepository } from "../repositories/implementations/MediaAssetRepository";
import { StorageUsageRepository } from "../../../shared/storage/repositories/StorageUsageRepository";
import { makeTeacherEntitlementsService } from "../../subscriptions/factories/make-teacher-entitlements-service";
import { CreateMediaAssetService, ListMediaAssetsService, ReviewMediaAssetService, ListPendingMediaAssetsService, GetQuarantinedMediaAssetService } from "../services/MediaAssetService";

export function makeCreateMediaAssetService(): CreateMediaAssetService {
  return new CreateMediaAssetService(new MediaAssetRepository(), makeTeacherEntitlementsService());
}
export function makeListMediaAssetsService(): ListMediaAssetsService {
  return new ListMediaAssetsService(new MediaAssetRepository());
}
export function makeListPendingMediaAssetsService(): ListPendingMediaAssetsService {
  return new ListPendingMediaAssetsService(new MediaAssetRepository());
}
export function makeReviewMediaAssetService(): ReviewMediaAssetService {
  return new ReviewMediaAssetService(new MediaAssetRepository(), new StorageUsageRepository(), makeTeacherEntitlementsService());
}

export function makeGetQuarantinedMediaAssetService(): GetQuarantinedMediaAssetService {
  return new GetQuarantinedMediaAssetService(new MediaAssetRepository());
}
