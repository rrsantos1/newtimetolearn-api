export interface CreateUploadUrlInput {
  contentType: string;
  extension: string;
}

export interface CreateUploadUrlResult {
  storageKey: string;
  uploadUrl: string;
  publicUrl: string;
  contentType: string;
  expiresInSeconds: number;
}

export interface UploadObjectInput {
  bucketName: string;
  storageKey: string;
  contentType: string;
  body: Buffer;
  cacheControl?: string;
}

export interface DownloadObjectResult {
  body: Buffer;
  contentType: string;
  contentLength: number;
  contentRange?: string;
}

export interface IStorageProvider {
  createUploadUrl(input: CreateUploadUrlInput): Promise<CreateUploadUrlResult>;
  uploadObject(input: UploadObjectInput): Promise<void>;
  downloadObject(storageKey: string, bucketName: string, range?: string): Promise<DownloadObjectResult>;
  createDownloadUrl(storageKey: string, bucketName: string, expiresInSeconds?: number): Promise<string>;
  deleteObject(storageKey: string, bucketName?: string): Promise<void>;
}
