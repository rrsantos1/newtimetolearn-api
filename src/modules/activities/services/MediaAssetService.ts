import vision from "@google-cloud/vision";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { env } from "../../../shared/config/env";
import { makeStorageProvider } from "../../../shared/storage/storageFactory";
import { optimizeImage } from "./ImageOptimizationService";
import type { IMediaAssetRepository, ListMediaAssetsFilters } from "../repositories/interfaces/IMediaAssetRepository";

const allowedContentTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
function hasValidImageSignature(contentType: string, body: Buffer): boolean {
  if (contentType === "image/jpeg") {
    return body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff;
  }
  if (contentType === "image/png") {
    return body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (contentType === "image/gif") {
    const signature = body.subarray(0, 6).toString("ascii");
    return signature === "GIF87a" || signature === "GIF89a";
  }
  if (contentType === "image/webp") {
    return body.subarray(0, 4).toString("ascii") === "RIFF"
      && body.subarray(8, 12).toString("ascii") === "WEBP";
  }
  return false;
}

const extensionByType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const blockedLikelihoods = new Set<number>([4, 5]);
const riskCategories = ["adult", "violence", "racy"] as const;
const GOOGLE_VISION_TIMEOUT_MS = 30_000;
type RiskCategory = (typeof riskCategories)[number];
type ModerationStatus = "APPROVED" | "REJECTED" | "PENDING_REVIEW";

const visionClient = env.GOOGLE_APPLICATION_CREDENTIALS
  ? new vision.ImageAnnotatorClient()
  : null;

async function moderateImage(imageBuffer: Buffer): Promise<ModerationStatus> {
  if (!visionClient) return "PENDING_REVIEW";
  const startedAt = Date.now();
  console.info("[MediaAsset] Google Vision iniciado.", { timeoutMs: GOOGLE_VISION_TIMEOUT_MS });
  try {
    let timeout: NodeJS.Timeout | undefined;
    const visionRequest = visionClient.safeSearchDetection({
      image: { content: imageBuffer },
    });
    const timeoutRequest = new Promise<never>((_, reject) => {
      timeout = setTimeout(
        () => reject(new Error("GOOGLE_VISION_TIMEOUT")),
        GOOGLE_VISION_TIMEOUT_MS,
      );
    });

    let result: Awaited<typeof visionRequest>[0];
    try {
      [result] = await Promise.race([visionRequest, timeoutRequest]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
    console.info("[MediaAsset] Google Vision concluído.", {
      durationMs: Date.now() - startedAt,
    });
    const annotation = result.safeSearchAnnotation;
    if (!annotation) return "PENDING_REVIEW";
    const rejected = riskCategories.some((category: RiskCategory) => {
      const likelihood = annotation[category];
      return typeof likelihood === "number" && blockedLikelihoods.has(likelihood);
    });
    return rejected ? "REJECTED" : "APPROVED";
  } catch (error: unknown) {
    console.warn("Falha na verificação automática Google Vision; imagem encaminhada para quarentena privada.", {
      durationMs: Date.now() - startedAt,
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
  isAdmin?: boolean;
}

export class CreateMediaAssetService {
  constructor(private readonly repository: IMediaAssetRepository) {}

  async execute(input: UploadMediaAssetInput) {
    if (!allowedContentTypes.has(input.contentType)) throw new Error("UNSUPPORTED_IMAGE_TYPE");
    if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > 5 * 1024 * 1024) {
      throw new Error("INVALID_IMAGE_SIZE");
    }
    if (input.imageBuffer.byteLength !== input.sizeBytes) throw new Error("INVALID_IMAGE_SIZE");
    if (!hasValidImageSignature(input.contentType, input.imageBuffer)) {
      throw new Error("INVALID_IMAGE_CONTENT");
    }

    const status = await moderateImage(input.imageBuffer);
    if (status === "REJECTED") throw new Error("IMAGE_REJECTED_BY_MODERATION");

    const date = new Date().toISOString().slice(0, 10);
    const id = randomUUID();
    const storage = makeStorageProvider();
    const isPending = status === "PENDING_REVIEW";
    const bucketName = isPending ? env.B2_QUARANTINE_BUCKET_NAME! : env.B2_BUCKET_NAME!;
    const optimized = isPending
      ? null
      : await optimizeImage(input.imageBuffer, input.contentType);
    const accountedBytes = (optimized?.imageBuffer.byteLength ?? input.sizeBytes)
      + (optimized?.thumbnailBuffer.byteLength ?? 0);
    if (!input.isAdmin) {
      const currentUsage = await this.repository.getStorageUsage(input.uploadedBy);
      if (currentUsage + accountedBytes > env.TEACHER_STORAGE_LIMIT_BYTES) {
        throw new Error("STORAGE_QUOTA_EXCEEDED");
      }
    }
    const finalContentType = optimized?.contentType ?? input.contentType;
    const extension = extensionByType[finalContentType];
    const storageKey = isPending
      ? `quarantine/${date}/${id}.${extensionByType[input.contentType]}`
      : `media/${date}/${id}.${extension}`;
    const thumbnailStorageKey = optimized
      ? `media/thumbnails/${date}/${id}.webp`
      : null;
    const publicBaseUrl = env.B2_PUBLIC_BASE_URL!.replace(/\/+$/, "");
    const uploadedKeys: string[] = [];

    try {
      await storage.uploadObject({
        bucketName,
        storageKey,
        contentType: finalContentType,
        body: optimized?.imageBuffer ?? input.imageBuffer,
        cacheControl: isPending
          ? "private, no-store"
          : "public, max-age=31536000, immutable",
      });
      uploadedKeys.push(storageKey);

      if (optimized && thumbnailStorageKey) {
        await storage.uploadObject({
          bucketName,
          storageKey: thumbnailStorageKey,
          contentType: "image/webp",
          body: optimized.thumbnailBuffer,
          cacheControl: "public, max-age=31536000, immutable",
        });
        uploadedKeys.push(thumbnailStorageKey);
      }

      return await this.repository.create({
        uploadedBy: input.uploadedBy,
        storageKey,
        publicUrl: isPending ? "" : `${publicBaseUrl}/${storageKey}`,
        fileName: input.fileName.trim().slice(0, 255),
        contentType: finalContentType,
        sizeBytes: optimized?.imageBuffer.byteLength ?? input.sizeBytes,
        thumbnailStorageKey,
        thumbnailPublicUrl: thumbnailStorageKey
          ? `${publicBaseUrl}/${thumbnailStorageKey}`
          : null,
        thumbnailSizeBytes: optimized?.thumbnailBuffer.byteLength ?? null,
        altText: input.altText.trim().slice(0, 250),
        status,
      });
    } catch (error: unknown) {
      await Promise.all(uploadedKeys.map((key) => storage.deleteObject(key, bucketName)));
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
  constructor(
    private readonly repository: IMediaAssetRepository,
    private readonly storageUsageRepository: StorageUsageRepository,
  ) {}

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
    const optimized = await optimizeImage(imageBuffer, asset.contentType);
    const isAdminUploader = await this.storageUsageRepository.isAdminUser(asset.uploadedBy);
    if (!isAdminUploader) {
      const currentUsage = await this.storageUsageRepository.getUsageByTeacherId(asset.uploadedBy);
      const projectedUsage = currentUsage - asset.sizeBytes
        + optimized.imageBuffer.byteLength
        + optimized.thumbnailBuffer.byteLength;
      if (projectedUsage > env.TEACHER_STORAGE_LIMIT_BYTES) {
        throw new Error("STORAGE_QUOTA_EXCEEDED");
      }
    }
    const date = new Date().toISOString().slice(0, 10);
    const idSuffix = randomUUID();
    const extension = extensionByType[optimized.contentType];
    const publicStorageKey = `media/${date}/${idSuffix}.${extension}`;
    const thumbnailStorageKey = `media/thumbnails/${date}/${idSuffix}.webp`;
    const publicBaseUrl = env.B2_PUBLIC_BASE_URL!.replace(/\/+$/, "");
    const uploadedKeys: string[] = [];

    try {
      await storage.uploadObject({
        bucketName: env.B2_BUCKET_NAME!,
        storageKey: publicStorageKey,
        contentType: optimized.contentType,
        body: optimized.imageBuffer,
        cacheControl: "public, max-age=31536000, immutable",
      });
      uploadedKeys.push(publicStorageKey);

      await storage.uploadObject({
        bucketName: env.B2_BUCKET_NAME!,
        storageKey: thumbnailStorageKey,
        contentType: "image/webp",
        body: optimized.thumbnailBuffer,
        cacheControl: "public, max-age=31536000, immutable",
      });
      uploadedKeys.push(thumbnailStorageKey);

      const updated = await this.repository.updateReview(
        id,
        "APPROVED",
        publicStorageKey,
        `${publicBaseUrl}/${publicStorageKey}`,
        {
          storageKey: thumbnailStorageKey,
          publicUrl: `${publicBaseUrl}/${thumbnailStorageKey}`,
          sizeBytes: optimized.thumbnailBuffer.byteLength,
        },
        {
          contentType: optimized.contentType,
          sizeBytes: optimized.imageBuffer.byteLength,
        },
      );
      try {
        await storage.deleteObject(asset.storageKey, env.B2_QUARANTINE_BUCKET_NAME);
      } catch (error: unknown) {
        console.warn("Imagem aprovada, mas não foi possível remover a cópia da quarentena.", error);
      }
      return updated;
    } catch (error: unknown) {
      await Promise.all(uploadedKeys.map((key) => storage.deleteObject(key, env.B2_BUCKET_NAME)));
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
