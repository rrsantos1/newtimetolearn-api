import vision from "@google-cloud/vision";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { env } from "../../../shared/config/env";
import { makeStorageProvider } from "../../../shared/storage/storageFactory";
import type { IMediaAssetRepository, ListMediaAssetsFilters } from "../repositories/interfaces/IMediaAssetRepository";

const allowedContentTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const extensionByType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const blockedLikelihoods = new Set<number>([4, 5]);
const riskCategories = ["adult", "violence", "racy"] as const;
type RiskCategory = (typeof riskCategories)[number];
type ModerationStatus = "APPROVED" | "REJECTED" | "PENDING_REVIEW";

const visionClient = env.GOOGLE_APPLICATION_CREDENTIALS
  ? new vision.ImageAnnotatorClient({ keyFilename: env.GOOGLE_APPLICATION_CREDENTIALS })
  : null;

async function moderateImage(imageBuffer: Buffer): Promise<ModerationStatus> {
  if (!visionClient) return "PENDING_REVIEW";
  try {
    const [result] = await visionClient.safeSearchDetection({ image: { content: imageBuffer } });
    const annotation = result.safeSearchAnnotation;
    if (!annotation) return "PENDING_REVIEW";
    const rejected = riskCategories.some((category: RiskCategory) => {
      const likelihood = annotation[category];
      return typeof likelihood === "number" && blockedLikelihoods.has(likelihood);
    });
    return rejected ? "REJECTED" : "APPROVED";
  } catch (error: unknown) {
    console.warn("Falha na verificação automática Google Vision; imagem encaminhada para quarentena privada.", {
      message: error instanceof Error ? error.message : "Erro desconhecido",
    });
    return "PENDING_REVIEW";
  }
}

export interface UploadMediaAssetInput {
  uploadedBy: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  altText: string;
  imageBuffer: Buffer;
}

export class CreateMediaAssetService {
  constructor(private readonly repository: IMediaAssetRepository) {}

  async execute(input: UploadMediaAssetInput) {
    if (!allowedContentTypes.has(input.contentType)) throw new Error("UNSUPPORTED_IMAGE_TYPE");
    if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > 5 * 1024 * 1024) {
      throw new Error("INVALID_IMAGE_SIZE");
    }
    if (input.imageBuffer.byteLength !== input.sizeBytes) throw new Error("INVALID_IMAGE_SIZE");

    const status = await moderateImage(input.imageBuffer);
    if (status === "REJECTED") throw new Error("IMAGE_REJECTED_BY_MODERATION");

    const extension = extensionByType[input.contentType];
    const date = new Date().toISOString().slice(0, 10);
    const id = randomUUID();
    const storage = makeStorageProvider();
    const isPending = status === "PENDING_REVIEW";
    const storageKey = isPending
      ? `quarantine/${date}/${id}.${extension}`
      : `media/${date}/${id}.${extension}`;
    const bucketName = isPending ? env.B2_QUARANTINE_BUCKET_NAME! : env.B2_BUCKET_NAME!;

    await storage.uploadObject({
      bucketName,
      storageKey,
      contentType: input.contentType,
      body: input.imageBuffer,
    });

    try {
      return await this.repository.create({
        uploadedBy: input.uploadedBy,
        storageKey,
        publicUrl: isPending ? "" : `${env.B2_PUBLIC_BASE_URL!.replace(/\/+$/, "")}/${storageKey}`,
        fileName: input.fileName.trim().slice(0, 255),
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        altText: input.altText.trim().slice(0, 250),
        status,
      });
    } catch (error: unknown) {
      await storage.deleteObject(storageKey, bucketName);
      throw error;
    }
  }
}

export class ListMediaAssetsService {
  constructor(private readonly repository: IMediaAssetRepository) {}
  execute(filters: ListMediaAssetsFilters) { return this.repository.list(filters); }
}

export class ListPendingMediaAssetsService {
  constructor(private readonly repository: IMediaAssetRepository) {}
  execute(filters: ListMediaAssetsFilters) {
    return this.repository.listPending(filters);
  }
}

export class ReviewMediaAssetService {
  constructor(private readonly repository: IMediaAssetRepository) {}

  async execute(id: string, decision: "APPROVE" | "REJECT") {
    const asset = await this.repository.findById(id);
    if (!asset) throw new Error("MEDIA_ASSET_NOT_FOUND");
    if (asset.status !== "PENDING_REVIEW") throw new Error("MEDIA_ASSET_ALREADY_REVIEWED");

    const storage = makeStorageProvider();
    if (decision === "REJECT") {
      await storage.deleteObject(asset.storageKey, env.B2_QUARANTINE_BUCKET_NAME);
      return this.repository.updateReview(id, "REJECTED", asset.storageKey, "");
    }

    const s3Client = new S3Client({
      endpoint: env.B2_S3_ENDPOINT!,
      region: env.B2_REGION!,
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.B2_APPLICATION_KEY_ID!,
        secretAccessKey: env.B2_APPLICATION_KEY!,
      },
    });
    const response = await s3Client.send(new GetObjectCommand({
      Bucket: env.B2_QUARANTINE_BUCKET_NAME!,
      Key: asset.storageKey,
    }));
    if (!response.Body) throw new Error("QUARANTINE_OBJECT_NOT_FOUND");

    const imageBuffer = Buffer.from(await response.Body.transformToByteArray());
    const extension = extensionByType[asset.contentType];
    const publicStorageKey = `media/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
    await storage.uploadObject({
      bucketName: env.B2_BUCKET_NAME!,
      storageKey: publicStorageKey,
      contentType: asset.contentType,
      body: imageBuffer,
    });

    const publicUrl = `${env.B2_PUBLIC_BASE_URL!.replace(/\\/+$/, "")}/${publicStorageKey}`;
    try {
      const updated = await this.repository.updateReview(id, "APPROVED", publicStorageKey, publicUrl);
      try {
        await storage.deleteObject(asset.storageKey, env.B2_QUARANTINE_BUCKET_NAME);
      } catch (error: unknown) {
        console.warn("Imagem aprovada, mas não foi possível remover a cópia da quarentena.", error);
      }
      return updated;
    } catch (error: unknown) {
      await storage.deleteObject(publicStorageKey, env.B2_BUCKET_NAME);
      throw error;
    }
  }
}

export class GetQuarantinedMediaAssetService {
  constructor(private readonly repository: IMediaAssetRepository) {}

  async execute(id: string): Promise<{ contentType: string; body: Buffer }> {
    const asset = await this.repository.findById(id);
    if (!asset) throw new Error("MEDIA_ASSET_NOT_FOUND");
    if (asset.status !== "PENDING_REVIEW") throw new Error("MEDIA_ASSET_NOT_PENDING");

    const client = new S3Client({
      endpoint: env.B2_S3_ENDPOINT!,
      region: env.B2_REGION!,
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.B2_APPLICATION_KEY_ID!,
        secretAccessKey: env.B2_APPLICATION_KEY!,
      },
    });
    const response = await client.send(new GetObjectCommand({
      Bucket: env.B2_QUARANTINE_BUCKET_NAME!,
      Key: asset.storageKey,
    }));
    if (!response.Body) throw new Error("QUARANTINE_OBJECT_NOT_FOUND");
    return { contentType: asset.contentType, body: Buffer.from(await response.Body.transformToByteArray()) };
  }
}
