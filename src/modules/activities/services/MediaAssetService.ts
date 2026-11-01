import vision from "@google-cloud/vision";
import { env } from "../../../shared/config/env";
import { makeStorageProvider } from "../../../shared/storage/storageFactory";
import type { CreateMediaAssetInput, IMediaAssetRepository, ListMediaAssetsFilters } from "../repositories/interfaces/IMediaAssetRepository";

const allowedContentTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const blockedLikelihoods = new Set<number>([4, 5]);
const riskCategories = ["adult", "violence", "racy"] as const;
type RiskCategory = (typeof riskCategories)[number];

const visionClient = env.GOOGLE_APPLICATION_CREDENTIALS
  ? new vision.ImageAnnotatorClient({ keyFilename: env.GOOGLE_APPLICATION_CREDENTIALS })
  : null;

async function moderateImage(publicUrl: string): Promise<"APPROVED" | "REJECTED" | "PENDING_REVIEW"> {
  if (!visionClient) {
    console.warn("Google Vision não configurado: GOOGLE_APPLICATION_CREDENTIALS ausente. Imagem encaminhada para revisão administrativa.");
    return "PENDING_REVIEW";
  }

  try {
    const [result] = await visionClient.safeSearchDetection(publicUrl);
    const annotation = result.safeSearchAnnotation;

    if (!annotation) {
      console.warn("Google Vision não retornou SafeSearch; imagem encaminhada para revisão administrativa.");
      return "PENDING_REVIEW";
    }

    const rejected = riskCategories.some((category: RiskCategory) => {
      const likelihood = annotation[category];
      return typeof likelihood === "number" && blockedLikelihoods.has(likelihood);
    });

    return rejected ? "REJECTED" : "APPROVED";
  } catch (error: unknown) {
    console.warn("Falha na verificação automática Google Vision; imagem encaminhada para revisão administrativa.", {
      message: error instanceof Error ? error.message : "Erro desconhecido",
    });
    return "PENDING_REVIEW";
  }
}

export class CreateMediaAssetService {
  constructor(private readonly repository: IMediaAssetRepository) {}
  async execute(input: CreateMediaAssetInput) {
    if (!allowedContentTypes.has(input.contentType)) throw new Error("UNSUPPORTED_IMAGE_TYPE");
    if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > 5 * 1024 * 1024) throw new Error("INVALID_IMAGE_SIZE");
    if (!/^media\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]+\.(jpg|png|webp|gif)$/i.test(input.storageKey)) throw new Error("INVALID_STORAGE_KEY");
    const configuredBaseUrl = env.B2_PUBLIC_BASE_URL?.replace(/\/$/, "");
    if (!configuredBaseUrl || !input.publicUrl.startsWith(`${configuredBaseUrl}/`)) throw new Error("INVALID_PUBLIC_URL");

    const status = await moderateImage(input.publicUrl);
    const asset = await this.repository.create({
      ...input,
      status,
      fileName: input.fileName.trim().slice(0, 255),
      altText: input.altText.trim().slice(0, 250),
    });

    if (status === "REJECTED") {
      await makeStorageProvider().deleteObject(input.storageKey);
    }

    return asset;
  }
}
export class ListMediaAssetsService {
  constructor(private readonly repository: IMediaAssetRepository) {}
  execute(filters: ListMediaAssetsFilters) { return this.repository.list(filters); }
}