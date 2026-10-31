import type { CreateMediaAssetInput, IMediaAssetRepository, ListMediaAssetsFilters } from "../repositories/interfaces/IMediaAssetRepository";

const allowedContentTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export class CreateMediaAssetService {
  constructor(private readonly repository: IMediaAssetRepository) {}
  async execute(input: CreateMediaAssetInput) {
    if (!allowedContentTypes.has(input.contentType)) throw new Error("UNSUPPORTED_IMAGE_TYPE");
    if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > 5 * 1024 * 1024) throw new Error("INVALID_IMAGE_SIZE");
    if (!/^quiz\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]+\.(jpg|png|webp|gif)$/i.test(input.storageKey)) throw new Error("INVALID_STORAGE_KEY");
    const configuredBaseUrl = process.env.B2_PUBLIC_BASE_URL?.replace(/\/$/, "");
    if (!configuredBaseUrl || !input.publicUrl.startsWith(`${configuredBaseUrl}/`)) throw new Error("INVALID_PUBLIC_URL");
    return this.repository.create({ ...input, fileName: input.fileName.trim().slice(0, 255), altText: input.altText.trim().slice(0, 250) });
  }
}
export class ListMediaAssetsService {
  constructor(private readonly repository: IMediaAssetRepository) {}
  execute(filters: ListMediaAssetsFilters) { return this.repository.list(filters); }
}
