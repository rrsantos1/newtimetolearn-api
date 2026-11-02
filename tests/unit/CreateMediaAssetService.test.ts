import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IMediaAssetRepository } from "../../src/modules/activities/repositories/interfaces/IMediaAssetRepository";

const { safeSearchDetection, uploadObject, deleteObject, repositoryCreate } = vi.hoisted(() => ({
  safeSearchDetection: vi.fn(),
  uploadObject: vi.fn(),
  deleteObject: vi.fn(),
  repositoryCreate: vi.fn(),
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
  },
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

  const imageBuffer = Buffer.from("fake-image-content");
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
    repositoryCreate.mockImplementation(async (asset) => ({
      id: "asset-123",
      ...asset,
    }));
    repository = {
      create: repositoryCreate,
    } as unknown as IMediaAssetRepository;
    service = new CreateMediaAssetService(repository);
  });

  it("envia imagem aprovada para o armazenamento público", async () => {
    const result = await service.execute(input);

    expect(safeSearchDetection).toHaveBeenCalledOnce();
    expect(uploadObject).toHaveBeenCalledWith(expect.objectContaining({
      bucketName: "media-test",
      contentType: "image/png",
      body: imageBuffer,
    }));
    expect(repositoryCreate).toHaveBeenCalledWith(expect.objectContaining({
      uploadedBy: input.uploadedBy,
      status: "APPROVED",
      fileName: "imagem.png",
      altText: "Ilustração de teste",
      publicUrl: expect.stringMatching(/^https:\/\/cdn\.example\.test\/media\//),
    }));
    expect(result).toMatchObject({ id: "asset-123", status: "APPROVED" });
  });

  it("envia imagem para quarentena quando a moderação não está disponível", async () => {
    safeSearchDetection.mockRejectedValue(new Error("Vision indisponível"));
    const warningSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = await service.execute(input);

    expect(uploadObject).toHaveBeenCalledWith(expect.objectContaining({
      bucketName: "quarantine-test",
      storageKey: expect.stringMatching(/^quarantine\//),
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

    expect(uploadObject).toHaveBeenCalledOnce();
    expect(deleteObject).toHaveBeenCalledWith(
      expect.stringMatching(/^media\//),
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
});
