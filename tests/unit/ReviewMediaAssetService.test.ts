import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IMediaAssetRepository } from "../../src/modules/activities/repositories/interfaces/IMediaAssetRepository";
import type { StorageUsageRepository } from "../../src/shared/storage/repositories/StorageUsageRepository";

const mocks = vi.hoisted(() => ({
  s3Send: vi.fn(),
  uploadObject: vi.fn(),
  deleteObject: vi.fn(),
  optimizeImage: vi.fn(),
  findById: vi.fn(),
  updateReview: vi.fn(),
  isAdminUser: vi.fn(),
  getUsage: vi.fn(),
}));

vi.mock("@aws-sdk/client-s3", () => ({
  GetObjectCommand: class {
    constructor(public readonly input: unknown) {}
  },
  S3Client: class {
    send = mocks.s3Send;
  },
}));

vi.mock("../../src/shared/config/env", () => ({
  env: {
    B2_S3_ENDPOINT: "https://s3.example.test",
    B2_REGION: "us-west-004",
    B2_APPLICATION_KEY_ID: "test-key-id",
    B2_APPLICATION_KEY: "test-secret",
    B2_QUARANTINE_BUCKET_NAME: "quarantine-test",
    B2_BUCKET_NAME: "media-test",
    B2_PUBLIC_BASE_URL: "https://cdn.example.test",
    TEACHER_STORAGE_LIMIT_BYTES: 1024,
  },
}));

vi.mock("../../src/modules/activities/services/ImageOptimizationService", () => ({
  optimizeImage: mocks.optimizeImage,
}));

vi.mock("../../src/shared/storage/storageFactory", () => ({
  makeStorageProvider: () => ({
    uploadObject: mocks.uploadObject,
    deleteObject: mocks.deleteObject,
  }),
}));

import { ReviewMediaAssetService } from "../../src/modules/activities/services/MediaAssetService";

describe("ReviewMediaAssetService", () => {
  const imageBuffer = Buffer.from("quarantined-image");
  const optimizedImage = Buffer.from("optimized-webp");
  const thumbnail = Buffer.from("thumbnail-webp");
  const asset = {
    id: "asset-123",
    uploadedBy: "teacher-123",
    storageKey: "quarantine/original.png",
    publicUrl: "",
    fileName: "imagem.png",
    contentType: "image/png",
    sizeBytes: 10,
    status: "PENDING_REVIEW",
  };

  let repository: IMediaAssetRepository;
  let storageUsageRepository: StorageUsageRepository;
  let service: ReviewMediaAssetService;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.s3Send.mockResolvedValue({
      Body: {
        transformToByteArray: vi.fn().mockResolvedValue(imageBuffer),
      },
    });
    mocks.optimizeImage.mockResolvedValue({
      imageBuffer: optimizedImage,
      contentType: "image/webp",
      thumbnailBuffer: thumbnail,
      isAnimated: false,
    });
    mocks.uploadObject.mockResolvedValue(undefined);
    mocks.deleteObject.mockResolvedValue(undefined);
    mocks.findById.mockResolvedValue(asset);
    mocks.updateReview.mockResolvedValue({ ...asset, status: "APPROVED" });
    mocks.isAdminUser.mockResolvedValue(false);
    mocks.getUsage.mockResolvedValue(0);

    repository = {
      create: vi.fn(),
      list: vi.fn(),
      listPending: vi.fn(),
      findById: mocks.findById,
      getStorageUsage: vi.fn(),
      updateReview: mocks.updateReview,
    };
    storageUsageRepository = {
      isAdminUser: mocks.isAdminUser,
      getUsageByTeacherId: mocks.getUsage,
      listReferencedObjects: vi.fn(),
    };
    service = new ReviewMediaAssetService(repository, storageUsageRepository);
  });

  it("impede aprovar uma imagem quando o tamanho otimizado excede a cota", async () => {
    mocks.getUsage.mockResolvedValue(1_020);

    await expect(service.execute(asset.id, "APPROVE")).rejects.toThrow("STORAGE_QUOTA_EXCEEDED");

    expect(mocks.isAdminUser).toHaveBeenCalledWith(asset.uploadedBy);
    expect(mocks.getUsage).toHaveBeenCalledWith(asset.uploadedBy);
    expect(mocks.uploadObject).not.toHaveBeenCalled();
    expect(mocks.updateReview).not.toHaveBeenCalled();
    expect(mocks.deleteObject).not.toHaveBeenCalled();
  });

  it("permite aprovação para administrador sem consultar a cota", async () => {
    mocks.isAdminUser.mockResolvedValue(true);

    const result = await service.execute(asset.id, "APPROVE");

    expect(mocks.getUsage).not.toHaveBeenCalled();
    expect(mocks.uploadObject).toHaveBeenCalledTimes(2);
    expect(mocks.updateReview).toHaveBeenCalledWith(
      asset.id,
      "APPROVED",
      expect.stringMatching(/^media\/\d{4}-\d{2}-\d{2}\//),
      expect.stringMatching(/^https:\/\/cdn\.example\.test\/media\//),
      expect.objectContaining({
        storageKey: expect.stringMatching(/^media\/thumbnails\//),
        sizeBytes: thumbnail.byteLength,
      }),
      {
        contentType: "image/webp",
        sizeBytes: optimizedImage.byteLength,
      },
    );
    expect(mocks.deleteObject).toHaveBeenCalledWith(asset.storageKey, "quarantine-test");
    expect(result).toMatchObject({ status: "APPROVED" });
  });

  it("remove da quarentena uma imagem rejeitada sem publicá-la", async () => {
    const rejected = { ...asset, status: "REJECTED" };
    mocks.updateReview.mockResolvedValue(rejected);

    const result = await service.execute(asset.id, "REJECT");

    expect(mocks.deleteObject).toHaveBeenCalledWith(asset.storageKey, "quarantine-test");
    expect(mocks.updateReview).toHaveBeenCalledWith(asset.id, "REJECTED", asset.storageKey, "");
    expect(mocks.s3Send).not.toHaveBeenCalled();
    expect(mocks.uploadObject).not.toHaveBeenCalled();
    expect(result).toEqual(rejected);
  });

  it("não permite revisar uma imagem inexistente ou já revisada", async () => {
    mocks.findById.mockResolvedValueOnce(null);
    await expect(service.execute(asset.id, "APPROVE")).rejects.toThrow("MEDIA_ASSET_NOT_FOUND");

    mocks.findById.mockResolvedValueOnce({ ...asset, status: "APPROVED" });
    await expect(service.execute(asset.id, "APPROVE")).rejects.toThrow("MEDIA_ASSET_ALREADY_REVIEWED");

    expect(mocks.s3Send).not.toHaveBeenCalled();
    expect(mocks.uploadObject).not.toHaveBeenCalled();
  });
});
