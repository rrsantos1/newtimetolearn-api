import type { MediaAsset } from "../../entities/MediaAsset";

export type MediaAssetStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED";
export interface CreateMediaAssetInput {
  uploadedBy: string;
  storageKey: string;
  publicUrl: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  thumbnailStorageKey?: string | null;
  thumbnailPublicUrl?: string | null;
  thumbnailSizeBytes?: number | null;
  altText: string;
  status?: MediaAssetStatus;
}
export interface ListMediaAssetsFilters { page: number; limit: number; search?: string; }
export interface ListMediaAssetsResult { items: MediaAsset[]; total: number; }
export interface IMediaAssetRepository {
  create(input: CreateMediaAssetInput): Promise<MediaAsset>;
  list(filters: ListMediaAssetsFilters): Promise<ListMediaAssetsResult>;
  listPending(filters: ListMediaAssetsFilters): Promise<ListMediaAssetsResult>;
  findById(id: string): Promise<MediaAsset | null>;
  getStorageUsage(uploadedBy: string): Promise<number>;
  listStoredKeys(): Promise<string[]>;
  updateReview(
    id: string,
    status: Exclude<MediaAssetStatus, "PENDING_REVIEW">,
    storageKey: string,
    publicUrl: string,
    thumbnail?: { storageKey: string; publicUrl: string; sizeBytes: number } | null,
  ): Promise<MediaAsset>;
}
