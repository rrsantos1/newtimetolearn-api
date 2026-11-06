import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IMediaAssetRepository } from "../../src/modules/activities/repositories/interfaces/IMediaAssetRepository";

const { safeSearchDetection, uploadObject, deleteObject, repositoryCreate, optimizeImage } = vi.hoisted(() => ({
  safeSearchDetection: vi.fn(),
  uploadObject: vi.fn(),
  deleteObject: vi.fn(),
  repositoryCreate: vi.fn(),
  optimizeImage: vi.fn(),
}));

vi.mock("@google-cloud/vision", () => ({
  default: {
    ImageAnnotatorClient: class {
      safeSearchDetection = safeSearchDetection;
    },
  },
}));

vi.mock("../../src/shared/config/env", () => ({
  env: {
    GOOGLE_APPLICATION_CREDENTIALS: "test-credentials.json",
    B2_QUARANTINE_BUCKET_NAME: "quarantine-test",
    B2_BUCKET_NAME: "media-test",
    B2_PUBLIC_BASE_URL: "https://cdn.example.test",
    TEACHER_STORAGE_LIMIT_BYTES: 1024,
  },
}));

vi.mock("../../src/modules/activities/services/ImageOptimizationService", () => ({
  optimizeImage,
}));

vi.mock("../../src/shared/storage/storageFactory", () => ({
  makeStorageProvider: () => ({
    uploadObject,
    deleteObject,
  }),
}));

import { CreateMediaAssetService } from "../../src/modules/activities/services/MediaAssetService";

describe("CreateMediaAssetService", () => {
  let repository: IMediaAssetRepository;
  let service: CreateMediaAssetService;

  const imageBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const input = {
    uploadedBy: "teacher-123",
    fileName: "  imagem.png  ",
    contentType: "image/png",
    sizeBytes: imageBuffer.byteLength,
    altText: "  Ilustração de teste  ",
    imageBuffer,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    safeSearchDetection.mockResolvedValue([{
      safeSearchAnnotation: { adult: 1, violence: 1, racy: 1 },
    }]);
    uploadObject.mockResolvedValue(undefined);
    deleteObject.mockResolvedValue(undefined);
    optimizeImage.mockResolvedValue({
      imageBuffer: Buffer.from("optimized-webp"),
      contentType: "image/webp",
      thumbnailBuffer: Buffer.from("thumbnail-webp"),
      isAnimated: false,
    });
    repositoryCreate.mockImplementation(async (asset) => ({
      id: "asset-123",
      ...asset,
    }));
    repository = {
      create: repositoryCreate,
      getStorageUsage: vi.fn().mockResolvedValue(0),
    } as unknown as IMediaAssetRepository;
    service = new CreateMediaAssetService(repository, {
      getForTeacher: vi.fn().mockResolvedValue({ storageLimitBytes: 1024 }),
    } as never);
  });

  it("envia imagem aprovada para o armazenamento público", async () => {
    const result = await service.execute(input);

    expect(safeSearchDetection).toHaveBeenCalledOnce();
    expect(uploadObject).toHaveBeenCalledWith(expect.objectContaining({
      bucketName: "media-test",
      contentType: "image/webp",
      body: Buffer.from("optimized-webp"),
      cacheControl: "public, max-age=31536000, immutable",
    }));
    expect(uploadObject).toHaveBeenCalledWith(expect.objectContaining({
      bucketName: "media-test",
      storageKey: expect.stringMatching(/^media\/thumbnails\//),
      contentType: "image/webp",
      body: Buffer.from("thumbnail-webp"),
    }));
    expect(repositoryCreate).toHaveBeenCalledWith(expect.objectContaining({
      uploadedBy: input.uploadedBy,
      status: "APPROVED",
      fileName: "imagem.png",
      contentType: "image/webp",
      sizeBytes: Buffer.byteLength("optimized-webp"),
      thumbnailStorageKey: expect.stringMatching(/^media\/thumbnails\//),
      thumbnailPublicUrl: expect.stringMatching(/^https:\/\/cdn\.example\.test\/media\/thumbnails\//),
      thumbnailSizeBytes: Buffer.byteLength("thumbnail-webp"),
      altText: "Ilustração de teste",
      publicUrl: expect.stringMatching(/^https:\/\/cdn\.example\.test\/media\//),
    }));
    expect(result).toMatchObject({ id: "asset-123", status: "APPROVED" });
  });

  it("envia imagem para quarentena quando a moderação não está disponível", async () => {
    safeSearchDetection.mockRejectedValue(new Error("Vision indisponível"));
    const warningSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = await service.execute(input);

    expect(optimizeImage).not.toHaveBeenCalled();
    expect(uploadObject).toHaveBeenCalledWith(expect.objectContaining({
      bucketName: "quarantine-test",
      storageKey: expect.stringMatching(/^quarantine\//),
      cacheControl: "private, no-store",
    }));
    expect(repositoryCreate).toHaveBeenCalledWith(expect.objectContaining({
      status: "PENDING_REVIEW",
      publicUrl: "",
    }));
    expect(result).toMatchObject({ id: "asset-123", status: "PENDING_REVIEW" });
    warningSpy.mockRestore();
  });

  it("rejeita tipos de arquivo não permitidos antes de chamar serviços externos", async () => {
    await expect(service.execute({
      ...input,
      contentType: "application/pdf",
    })).rejects.toThrow("UNSUPPORTED_IMAGE_TYPE");

    expect(safeSearchDetection).not.toHaveBeenCalled();
    expect(uploadObject).not.toHaveBeenCalled();
    expect(repositoryCreate).not.toHaveBeenCalled();
  });

  it("rejeita conteúdo que não corresponde ao MIME type declarado", async () => {
    await expect(service.execute({
      ...input,
      imageBuffer: Buffer.from("not-an-image"),
      sizeBytes: Buffer.byteLength("not-an-image"),
    })).rejects.toThrow("INVALID_IMAGE_CONTENT");

    expect(safeSearchDetection).not.toHaveBeenCalled();
    expect(uploadObject).not.toHaveBeenCalled();
    expect(repositoryCreate).not.toHaveBeenCalled();
  });

  it("rejeita imagens maiores que 5 MB", async () => {
    await expect(service.execute({
      ...input,
      sizeBytes: 5 * 1024 * 1024 + 1,
    })).rejects.toThrow("INVALID_IMAGE_SIZE");

    expect(safeSearchDetection).not.toHaveBeenCalled();
    expect(uploadObject).not.toHaveBeenCalled();
  });

  it("remove o arquivo do armazenamento se a persistência falhar", async () => {
    repositoryCreate.mockRejectedValue(new Error("Falha no banco"));

    await expect(service.execute(input)).rejects.toThrow("Falha no banco");

    expect(uploadObject).toHaveBeenCalledTimes(2);
    expect(deleteObject).toHaveBeenCalledWith(
      expect.stringMatching(/^media\/\d{4}-\d{2}-\d{2}\//),
      "media-test",
    );
    expect(deleteObject).toHaveBeenCalledWith(
      expect.stringMatching(/^media\/thumbnails\//),
      "media-test",
    );
  });

  it("rejeita imagens sinalizadas como inadequadas", async () => {
    safeSearchDetection.mockResolvedValue([{
      safeSearchAnnotation: { adult: 5, violence: 1, racy: 1 },
    }]);

    await expect(service.execute(input)).rejects.toThrow("IMAGE_REJECTED_BY_MODERATION");
    expect(uploadObject).not.toHaveBeenCalled();
    expect(repositoryCreate).not.toHaveBeenCalled();
  });
  it("bloqueia o upload quando a imagem otimizada ultrapassa a cota", async () => {
    (repository.getStorageUsage as ReturnType<typeof vi.fn>).mockResolvedValue(1_010);

    await expect(service.execute(input)).rejects.toThrow("STORAGE_QUOTA_EXCEEDED");

    expect(repository.getStorageUsage).toHaveBeenCalledWith(input.uploadedBy);
    expect(uploadObject).not.toHaveBeenCalled();
    expect(repositoryCreate).not.toHaveBeenCalled();
  });

  it("permite que administradores façam upload sem consumir a cota do professor", async () => {
    (repository.getStorageUsage as ReturnType<typeof vi.fn>).mockResolvedValue(10_000);

    const result = await service.execute({ ...input, isAdmin: true });

    expect(repository.getStorageUsage).not.toHaveBeenCalled();
    expect(uploadObject).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ id: "asset-123", status: "APPROVED" });
  });

});