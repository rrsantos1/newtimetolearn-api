import { env } from "../../../shared/config/env";
import type { CreateMediaAssetInput, IMediaAssetRepository, ListMediaAssetsFilters } from "../repositories/interfaces/IMediaAssetRepository";

const allowedContentTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
type Likelihood = "UNKNOWN" | "VERY_UNLIKELY" | "UNLIKELY" | "POSSIBLE" | "LIKELY" | "VERY_LIKELY";
interface SafeSearchAnnotation {
  adult?: Likelihood;
  violence?: Likelihood;
  racy?: Likelihood;
}
interface VisionResponse {
  responses?: Array<{ safeSearchAnnotation?: SafeSearchAnnotation; error?: { message?: string } }>;
}
const blockedLikelihoods = new Set<Likelihood>(["LIKELY", "VERY_LIKELY"]);
const riskCategories: Array<keyof SafeSearchAnnotation> = ["adult", "violence", "racy"];

async function moderateImage(publicUrl: string): Promise<"APPROVED" | "REJECTED" | "PENDING_REVIEW"> {
  if (!env.GOOGLE_VISION_API_KEY) return "PENDING_REVIEW";

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(env.GOOGLE_VISION_API_KEY)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{
          image: { source: { imageUri: publicUrl } },
          features: [{ type: "SAFE_SEARCH_DETECTION" }],
        }],
      }),
    },
  );

  if (!response.ok) throw new Error("IMAGE_MODERATION_FAILED");
  const result = await response.json() as VisionResponse;
  const annotation = result.responses?.[0]?.safeSearchAnnotation;
  if (!annotation) throw new Error("IMAGE_MODERATION_FAILED");

  const rejected = riskCategories.some((category) => {
    const likelihood = annotation[category];
    return likelihood !== undefined && blockedLikelihoods.has(likelihood);
  });
  return rejected ? "REJECTED" : "APPROVED";
}

export class CreateMediaAssetService {
  constructor(private readonly repository: IMediaAssetRepository) {}
  async execute(input: CreateMediaAssetInput) {
    if (!allowedContentTypes.has(input.contentType)) throw new Error("UNSUPPORTED_IMAGE_TYPE");
    if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > 5 * 1024 * 1024) throw new Error("INVALID_IMAGE_SIZE");
    if (!/^quiz\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]+\.(jpg|png|webp|gif)$/i.test(input.storageKey)) throw new Error("INVALID_STORAGE_KEY");
    const configuredBaseUrl = env.B2_PUBLIC_BASE_URL?.replace(/\/$/, "");
    if (!configuredBaseUrl || !input.publicUrl.startsWith(`${configuredBaseUrl}/`)) throw new Error("INVALID_PUBLIC_URL");

    const status = await moderateImage(input.publicUrl);
    return this.repository.create({
      ...input,
      status,
      fileName: input.fileName.trim().slice(0, 255),
      altText: input.altText.trim().slice(0, 250),
    });
  }
}
export class ListMediaAssetsService {
  constructor(private readonly repository: IMediaAssetRepository) {}
  execute(filters: ListMediaAssetsFilters) { return this.repository.list(filters); }
}
