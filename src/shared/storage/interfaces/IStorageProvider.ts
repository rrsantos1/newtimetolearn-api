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

export interface IStorageProvider {
  createUploadUrl(input: CreateUploadUrlInput): Promise<CreateUploadUrlResult>;
  deleteObject(storageKey: string): Promise<void>;
}
