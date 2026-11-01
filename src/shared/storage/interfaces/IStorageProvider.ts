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

export interface IStorageProvider {
  createUploadUrl(input: CreateUploadUrlInput): Promise<CreateUploadUrlResult>;
  uploadObject(input: UploadObjectInput): Promise<void>;
  deleteObject(storageKey: string, bucketName?: string): Promise<void>;
}
