import { createHash, createHmac, randomUUID } from "node:crypto";
import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "../../config/env";
import type {
  CreateUploadUrlInput,
  CreateUploadUrlResult,
  IStorageProvider,
  UploadObjectInput,
  StorageObjectInfo,
} from "../interfaces/IStorageProvider";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ALLOWED_OBJECT_TYPES = new Set([
  ...ALLOWED_IMAGE_TYPES,
  "audio/mpeg",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);
const EXTENSIONS_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const UPLOAD_URL_EXPIRES_IN_SECONDS = 300;
const S3_SERVICE = "s3";
const AWS_ALGORITHM = "AWS4-HMAC-SHA256";
const DEFAULT_OBJECT_UPLOAD_TIMEOUT_MS = 60_000;
const VIDEO_UPLOAD_TIMEOUT_MS = 300_000;

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function encodePath(value: string): string {
  return value.split("/").map(encodeRfc3986).join("/");
}

function getSigningKey(secretKey: string, dateStamp: string, region: string): Buffer {
  const dateKey = hmac(`AWS4${secretKey}`, dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, S3_SERVICE);
  return hmac(serviceKey, "aws4_request");
}

export class BackblazeStorageProvider implements IStorageProvider {
  private readonly s3Client: S3Client;

  constructor() {
    if (!env.B2_S3_ENDPOINT || !env.B2_REGION || !env.B2_BUCKET_NAME ||
        !env.B2_QUARANTINE_BUCKET_NAME || !env.B2_APPLICATION_KEY_ID ||
        !env.B2_APPLICATION_KEY || !env.B2_PUBLIC_BASE_URL) {
      throw new Error("A configuração do Backblaze B2 não foi definida.");
    }

    this.s3Client = new S3Client({
      endpoint: env.B2_S3_ENDPOINT,
      region: env.B2_REGION,
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.B2_APPLICATION_KEY_ID,
        secretAccessKey: env.B2_APPLICATION_KEY,
      },
    });
  }

  async createUploadUrl(input: CreateUploadUrlInput): Promise<CreateUploadUrlResult> {
    if (!ALLOWED_IMAGE_TYPES.has(input.contentType)) throw new Error("UNSUPPORTED_IMAGE_TYPE");
    const extension = EXTENSIONS_BY_CONTENT_TYPE[input.contentType];
    if (input.extension !== extension) throw new Error("INVALID_IMAGE_EXTENSION");

    const endpoint = new URL(env.B2_S3_ENDPOINT!);
    if (endpoint.protocol !== "https:" || endpoint.pathname !== "/") throw new Error("INVALID_STORAGE_ENDPOINT");

    const storageKey = `media/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
    const canonicalUri = `/${encodePath(env.B2_BUCKET_NAME!)}/${encodePath(storageKey)}`;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const credentialScope = `${dateStamp}/${env.B2_REGION}/${S3_SERVICE}/aws4_request`;
    const signedHeaders = "content-type;host";
    const queryParameters: Record<string, string> = {
      "X-Amz-Algorithm": AWS_ALGORITHM,
      "X-Amz-Credential": `${env.B2_APPLICATION_KEY_ID}/${credentialScope}`,
      "X-Amz-Date": amzDate,
      "X-Amz-Expires": String(UPLOAD_URL_EXPIRES_IN_SECONDS),
      "X-Amz-SignedHeaders": signedHeaders,
    };
    const canonicalQueryString = Object.entries(queryParameters)
      .map(([key, value]) => [encodeRfc3986(key), encodeRfc3986(value)] as const)
      .sort(([keyA, valueA], [keyB, valueB]) => keyA === keyB ? (valueA < valueB ? -1 : valueA > valueB ? 1 : 0) : (keyA < keyB ? -1 : 1))
      .map(([key, value]) => `${key}=${value}`).join("&");
    const canonicalHeaders = `content-type:${input.contentType}\nhost:${endpoint.host}\n`;
    const canonicalRequest = ["PUT", canonicalUri, canonicalQueryString, canonicalHeaders, signedHeaders, "UNSIGNED-PAYLOAD"].join("\n");
    const stringToSign = [AWS_ALGORITHM, amzDate, credentialScope, sha256(canonicalRequest)].join("\n");
    const signature = hmac(getSigningKey(env.B2_APPLICATION_KEY!, dateStamp, env.B2_REGION!), stringToSign).toString("hex");
    const uploadUrl = `${endpoint.origin}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;

    return {
      storageKey,
      uploadUrl,
      publicUrl: `${env.B2_PUBLIC_BASE_URL!.replace(/\/+$/, "")}/${storageKey}`,
      contentType: input.contentType,
      expiresInSeconds: UPLOAD_URL_EXPIRES_IN_SECONDS,
    };
  }

  async uploadObject(input: UploadObjectInput): Promise<void> {
    if (!ALLOWED_OBJECT_TYPES.has(input.contentType)) throw new Error("UNSUPPORTED_STORAGE_CONTENT_TYPE");
    const maxSizeBytes = input.contentType.startsWith("video/")
      ? 50 * 1024 * 1024
      : input.contentType === "audio/mpeg" ? 20 * 1024 * 1024 : 20 * 1024 * 1024;
    if (input.body.byteLength <= 0 || input.body.byteLength > maxSizeBytes) throw new Error("INVALID_STORAGE_OBJECT_SIZE");

    const timeoutMs = input.contentType.startsWith("video/")
      ? VIDEO_UPLOAD_TIMEOUT_MS
      : DEFAULT_OBJECT_UPLOAD_TIMEOUT_MS;
    const startedAt = Date.now();
    console.info("[Backblaze] Upload iniciado.", {
      bucketName: input.bucketName,
      storageKey: input.storageKey,
      sizeBytes: input.body.byteLength,
      timeoutMs,
    });

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: input.bucketName,
          Key: input.storageKey,
          Body: input.body,
          ContentType: input.contentType,
          ...(input.cacheControl ? { CacheControl: input.cacheControl } : {}),
        }),
        { abortSignal: AbortSignal.timeout(timeoutMs) },
      );
      console.info("[Backblaze] Upload concluído.", {
        storageKey: input.storageKey,
        durationMs: Date.now() - startedAt,
      });
    } catch (error: unknown) {
      console.error("[Backblaze] Upload falhou.", {
        storageKey: input.storageKey,
        durationMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : "Erro desconhecido",
      });
      throw error;
    }
  }

  async downloadObject(storageKey: string, bucketName: string, range?: string): Promise<{ body: Buffer; contentType: string; contentLength: number; contentRange?: string }> {
    const response = await this.s3Client.send(new GetObjectCommand({
      Bucket: bucketName,
      Key: storageKey,
      ...(range ? { Range: range } : {}),
    }));
    if (!response.Body) throw new Error("STORAGE_OBJECT_NOT_FOUND");
    return {
      body: Buffer.from(await response.Body.transformToByteArray()),
      contentType: response.ContentType ?? "application/octet-stream",
      contentLength: response.ContentLength ?? 0,
      ...(response.ContentRange ? { contentRange: response.ContentRange } : {}),
    };
  }

  async createDownloadUrl(storageKey: string, bucketName: string, expiresInSeconds = 300): Promise<string> {
    if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 60 || expiresInSeconds > 3600) {
      throw new Error("INVALID_DOWNLOAD_URL_EXPIRATION");
    }

    const endpoint = new URL(env.B2_S3_ENDPOINT!);
    if (endpoint.protocol !== "https:" || endpoint.pathname !== "/") {
      throw new Error("INVALID_STORAGE_ENDPOINT");
    }

    const canonicalUri = "/" + encodePath(bucketName) + "/" + encodePath(storageKey);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const credentialScope = dateStamp + "/" + env.B2_REGION + "/" + S3_SERVICE + "/aws4_request";
    const queryParameters: Record<string, string> = {
      "X-Amz-Algorithm": AWS_ALGORITHM,
      "X-Amz-Credential": env.B2_APPLICATION_KEY_ID! + "/" + credentialScope,
      "X-Amz-Date": amzDate,
      "X-Amz-Expires": String(expiresInSeconds),
      "X-Amz-SignedHeaders": "host",
    };
    const canonicalQueryString = Object.entries(queryParameters)
      .map(([key, value]) => [encodeRfc3986(key), encodeRfc3986(value)] as const)
      .sort(([keyA, valueA], [keyB, valueB]) => keyA === keyB ? (valueA < valueB ? -1 : valueA > valueB ? 1 : 0) : (keyA < keyB ? -1 : 1))
      .map(([key, value]) => key + "=" + value).join("&");
    const canonicalHeaders = "host:" + endpoint.host + "\n";
    const canonicalRequest = ["GET", canonicalUri, canonicalQueryString, canonicalHeaders, "host", "UNSIGNED-PAYLOAD"].join("\n");
    const stringToSign = [AWS_ALGORITHM, amzDate, credentialScope, sha256(canonicalRequest)].join("\n");
    const signature = hmac(getSigningKey(env.B2_APPLICATION_KEY!, dateStamp, env.B2_REGION!), stringToSign).toString("hex");

    return endpoint.origin + canonicalUri + "?" + canonicalQueryString + "&X-Amz-Signature=" + signature;
  }

  async listObjects(bucketName: string, prefix: string): Promise<StorageObjectInfo[]> {
    const objects: StorageObjectInfo[] = [];
    let continuationToken: string | undefined;

    do {
      const response = await this.s3Client.send(new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      }));

      for (const object of response.Contents ?? []) {
        if (!object.Key) continue;
        objects.push({
          key: object.Key,
          sizeBytes: object.Size ?? 0,
          lastModified: object.LastModified ?? null,
        });
      }

      continuationToken = response.IsTruncated
        ? response.NextContinuationToken
        : undefined;
    } while (continuationToken);

    return objects;
  }

  async deleteObject(storageKey: string, bucketName = env.B2_BUCKET_NAME): Promise<void> {
    const endpoint = new URL(env.B2_S3_ENDPOINT!);
    const canonicalUri = "/" + encodePath(bucketName!) + "/" + encodePath(storageKey);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const credentialScope = dateStamp + "/" + env.B2_REGION + "/" + S3_SERVICE + "/aws4_request";
    const signedHeaders = "host";
    const queryParameters: Record<string, string> = {
      "X-Amz-Algorithm": AWS_ALGORITHM,
      "X-Amz-Credential": env.B2_APPLICATION_KEY_ID! + "/" + credentialScope,
      "X-Amz-Date": amzDate,
      "X-Amz-Expires": String(UPLOAD_URL_EXPIRES_IN_SECONDS),
      "X-Amz-SignedHeaders": signedHeaders,
    };
    const canonicalQueryString = Object.entries(queryParameters)
      .map(([key, value]) => [encodeRfc3986(key), encodeRfc3986(value)] as const)
      .sort(([keyA, valueA], [keyB, valueB]) => keyA === keyB ? (valueA < valueB ? -1 : valueA > valueB ? 1 : 0) : (keyA < keyB ? -1 : 1))
      .map(([key, value]) => key + "=" + value).join("&");
    const canonicalHeaders = "host:" + endpoint.host + "\n";
    const canonicalRequest = ["DELETE", canonicalUri, canonicalQueryString, canonicalHeaders, signedHeaders, "UNSIGNED-PAYLOAD"].join("\n");
    const stringToSign = [AWS_ALGORITHM, amzDate, credentialScope, sha256(canonicalRequest)].join("\n");
    const signature = hmac(getSigningKey(env.B2_APPLICATION_KEY!, dateStamp, env.B2_REGION!), stringToSign).toString("hex");
    const deleteUrl = endpoint.origin + canonicalUri + "?" + canonicalQueryString + "&X-Amz-Signature=" + signature;
    const response = await fetch(deleteUrl, { method: "DELETE" });
    if (!response.ok && response.status !== 404) throw new Error("STORAGE_DELETE_FAILED");
  }
}
