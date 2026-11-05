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
}

export interface DownloadObjectResult {
  body: Buffer;
  contentType: string;
}

export interface IStorageProvider {
  createUploadUrl(input: CreateUploadUrlInput): Promise<CreateUploadUrlResult>;
  uploadObject(input: UploadObjectInput): Promise<void>;
  downloadObject(storageKey: string, bucketName: string): Promise<DownloadObjectResult>;
  deleteObject(storageKey: string, bucketName?: string): Promise<void>;
}
