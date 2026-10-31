import { AppDataSource } from "../../../../shared/database/data-source";
import { MediaAsset } from "../../entities/MediaAsset";
import type { CreateMediaAssetInput, IMediaAssetRepository, ListMediaAssetsFilters, ListMediaAssetsResult } from "../interfaces/IMediaAssetRepository";

export class MediaAssetRepository implements IMediaAssetRepository {
  private readonly repository = AppDataSource.getRepository(MediaAsset);

  async create(input: CreateMediaAssetInput): Promise<MediaAsset> {
    return this.repository.save(this.repository.create({ ...input, status: input.status ?? "PENDING_REVIEW" }));
  }

  async list(filters: ListMediaAssetsFilters): Promise<ListMediaAssetsResult> {
    const query = this.repository.createQueryBuilder("asset")
      .where("asset.status = :status", { status: "APPROVED" });
    if (filters.search?.trim()) {
      query.andWhere("(LOWER(asset.file_name) LIKE :search OR LOWER(asset.alt_text) LIKE :search)", {
        search: `%${filters.search.trim().toLocaleLowerCase("pt-BR")}%`,
      });
    }
    const [items, total] = await query.orderBy("asset.created_at", "DESC")
      .skip((filters.page - 1) * filters.limit).take(filters.limit).getManyAndCount();
    return { items, total };
  }
}
