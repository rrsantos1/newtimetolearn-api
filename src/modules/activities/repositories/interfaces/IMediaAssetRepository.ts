import type { MediaAsset } from "../../entities/MediaAsset";

export interface CreateMediaAssetInput {
  uploadedBy: string;
  storageKey: string;
  publicUrl: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  altText: string;
  status?: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
}
export interface ListMediaAssetsFilters { page: number; limit: number; search?: string; }
export interface ListMediaAssetsResult { items: MediaAsset[]; total: number; }
export interface IMediaAssetRepository {
  create(input: CreateMediaAssetInput): Promise<MediaAsset>;
  list(filters: ListMediaAssetsFilters): Promise<ListMediaAssetsResult>;
}
