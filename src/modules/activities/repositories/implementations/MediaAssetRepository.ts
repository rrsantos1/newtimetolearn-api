import { AppDataSource } from "../../../../shared/database/data-source";
import { MediaAsset } from "../../entities/MediaAsset";
import { StorageUsageRepository } from "../../../../shared/storage/repositories/StorageUsageRepository";
import type { CreateMediaAssetInput, IMediaAssetRepository, ListMediaAssetsFilters, ListMediaAssetsResult, MediaAssetStatus } from "../interfaces/IMediaAssetRepository";

export class MediaAssetRepository implements IMediaAssetRepository {
  private readonly repository = AppDataSource.getRepository(MediaAsset);

  async create(input: CreateMediaAssetInput): Promise<MediaAsset> {
    return this.repository.save(this.repository.create({ ...input, status: input.status ?? "PENDING_REVIEW" }));
  }

  private async listByStatus(filters: ListMediaAssetsFilters, status: MediaAssetStatus): Promise<ListMediaAssetsResult> {
    const query = this.repository.createQueryBuilder("asset")
      .where("asset.status = :status", { status });
    if (filters.search?.trim()) {
      query.andWhere("(LOWER(asset.file_name) LIKE :search OR LOWER(asset.alt_text) LIKE :search)", {
        search: `%${filters.search.trim().toLocaleLowerCase("pt-BR")}%`,
      });
    }
    const [items, total] = await query.orderBy("asset.created_at", "DESC")
      .skip((filters.page - 1) * filters.limit).take(filters.limit).getManyAndCount();
    return { items, total };
  }

  async list(filters: ListMediaAssetsFilters): Promise<ListMediaAssetsResult> {
    return this.listByStatus(filters, "APPROVED");
  }

  async listPending(filters: ListMediaAssetsFilters): Promise<ListMediaAssetsResult> {
    return this.listByStatus(filters, "PENDING_REVIEW");
  }

  async findById(id: string): Promise<MediaAsset | null> {
    return this.repository.findOneBy({ id });
  }

  async getStorageUsage(uploadedBy: string): Promise<number> {
    return new StorageUsageRepository().getUsageByTeacherId(uploadedBy);
  }

  async updateReview(
    id: string,
    status: Exclude<MediaAssetStatus, "PENDING_REVIEW">,
    storageKey: string,
    publicUrl: string,
    thumbnail?: { storageKey: string; publicUrl: string; sizeBytes: number } | null,
  ): Promise<MediaAsset> {
    const asset = await this.repository.findOneBy({ id });
    if (!asset) throw new Error("MEDIA_ASSET_NOT_FOUND");
    if (asset.status !== "PENDING_REVIEW") throw new Error("MEDIA_ASSET_ALREADY_REVIEWED");
    asset.status = status;
    asset.storageKey = storageKey;
    asset.publicUrl = publicUrl;
    asset.thumbnailStorageKey = thumbnail?.storageKey ?? null;
    asset.thumbnailPublicUrl = thumbnail?.publicUrl ?? null;
    asset.thumbnailSizeBytes = thumbnail?.sizeBytes ?? null;
    return this.repository.save(asset);
  }
}
