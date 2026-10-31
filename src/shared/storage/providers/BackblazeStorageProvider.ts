import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../../config/env";
import type {
  CreateUploadUrlInput,
  CreateUploadUrlResult,
  IStorageProvider,
} from "../interfaces/IStorageProvider";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const EXTENSIONS_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export class BackblazeStorageProvider implements IStorageProvider {
  private readonly client: S3Client;

  constructor() {
    if (
      !env.B2_S3_ENDPOINT ||
      !env.B2_REGION ||
      !env.B2_BUCKET_NAME ||
      !env.B2_APPLICATION_KEY_ID ||
      !env.B2_APPLICATION_KEY ||
      !env.B2_PUBLIC_BASE_URL
    ) {
      throw new Error("A configuração do Backblaze B2 não foi definida.");
    }

    this.client = new S3Client({
      endpoint: env.B2_S3_ENDPOINT,
      region: env.B2_REGION,
      credentials: {
        accessKeyId: env.B2_APPLICATION_KEY_ID,
        secretAccessKey: env.B2_APPLICATION_KEY,
      },
    });
  }

  async createUploadUrl(
    input: CreateUploadUrlInput,
  ): Promise<CreateUploadUrlResult> {
    if (!ALLOWED_IMAGE_TYPES.has(input.contentType)) {
      throw new Error("UNSUPPORTED_IMAGE_TYPE");
    }

    const extension = EXTENSIONS_BY_CONTENT_TYPE[input.contentType];
    if (input.extension !== extension) {
      throw new Error("INVALID_IMAGE_EXTENSION");
    }

    const storageKey = `quiz/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
    const command = new PutObjectCommand({
      Bucket: env.B2_BUCKET_NAME,
      Key: storageKey,
      ContentType: input.contentType,
      CacheControl: "public, max-age=31536000, immutable",
    });

    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: 300,
    });

    return {
      storageKey,
      uploadUrl,
      publicUrl: `${env.B2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${storageKey}`,
      contentType: input.contentType,
      expiresInSeconds: 300,
    };
  }
}
