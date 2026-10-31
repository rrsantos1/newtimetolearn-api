import { createHash, createHmac, randomUUID } from "node:crypto";
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

const UPLOAD_URL_EXPIRES_IN_SECONDS = 300;
const S3_SERVICE = "s3";
const AWS_ALGORITHM = "AWS4-HMAC-SHA256";

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

    const endpoint = new URL(env.B2_S3_ENDPOINT!);
    if (endpoint.protocol !== "https:" || endpoint.pathname !== "/") {
      throw new Error("INVALID_STORAGE_ENDPOINT");
    }

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
      .sort(([keyA, valueA], [keyB, valueB]) =>
        keyA.localeCompare(keyB) || valueA.localeCompare(valueB),
      )
      .map(([key, value]) => `${key}=${value}`)
      .join("&");

    const canonicalHeaders = `content-type:${input.contentType}\nhost:${endpoint.host}\n`;
    const canonicalRequest = [
      "PUT",
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      "UNSIGNED-PAYLOAD",
    ].join("\n");

    const stringToSign = [
      AWS_ALGORITHM,
      amzDate,
      credentialScope,
      sha256(canonicalRequest),
    ].join("\n");

    const signature = hmac(
      getSigningKey(env.B2_APPLICATION_KEY!, dateStamp, env.B2_REGION!),
      stringToSign,
    ).toString("hex");

    const uploadUrl = `${endpoint.origin}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;

    return {
      storageKey,
      uploadUrl,
      publicUrl: `${env.B2_PUBLIC_BASE_URL!.replace(/\/$/, "")}/${storageKey}`,
      contentType: input.contentType,
      expiresInSeconds: UPLOAD_URL_EXPIRES_IN_SECONDS,
    };
  }
}
