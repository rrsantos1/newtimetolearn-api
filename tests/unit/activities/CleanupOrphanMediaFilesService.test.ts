import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { listObjects, deleteObject } = vi.hoisted(() => ({
  listObjects: vi.fn(),
  deleteObject: vi.fn(),
}));

vi.mock("../../../src/shared/config/env", () => ({
  env: {
    B2_BUCKET_NAME: "public-test",
    B2_QUARANTINE_BUCKET_NAME: "private-test",
  },
}));

vi.mock("../../../src/shared/storage/storageFactory", () => ({
  makeStorageProvider: () => ({ listObjects, deleteObject }),
}));

import { CleanupOrphanMediaFilesService } from "../../../src/modules/activities/services/CleanupOrphanMediaFilesService";
import type { StorageUsageRepository } from "../../../src/shared/storage/repositories/StorageUsageRepository";

describe("CleanupOrphanMediaFilesService", () => {
  const now = new Date("2026-11-06T15:00:00.000Z");
  const oldDate = new Date(now.getTime() - 25 * 60 * 60 * 1000);
  const recentDate = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  let repository: { listReferencedObjects: ReturnType<typeof vi.fn> };
  let service: CleanupOrphanMediaFilesService;

  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.clearAllMocks();

    repository = {
      listReferencedObjects: vi.fn().mockResolvedValue([
        { bucketName: "public-test", storageKey: "media/referenced.webp" },
      ]),
    };
    listObjects.mockImplementation(async (bucketName: string, prefix: string) => {
      if (bucketName === "public-test" && prefix === "media/") {
        return [
          { key: "media/referenced.webp", sizeBytes: 100, lastModified: oldDate },
          { key: "media/orphan.webp", sizeBytes: 200, lastModified: oldDate },
          { key: "media/recent.webp", sizeBytes: 300, lastModified: recentDate },
          { key: "media/unknown-date.webp", sizeBytes: 400, lastModified: null },
        ];
      }
      return [];
    });
    deleteObject.mockResolvedValue(undefined);

    service = new CleanupOrphanMediaFilesService(
      repository as unknown as StorageUsageRepository,
    );
  });

  it("faz a varredura dos quatro prefixos nos dois buckets", async () => {
    await service.execute();

    expect(listObjects).toHaveBeenCalledTimes(4);
    expect(listObjects).toHaveBeenNthCalledWith(1, "public-test", "media/");
    expect(listObjects).toHaveBeenNthCalledWith(2, "public-test", "audio/listening/");
    expect(listObjects).toHaveBeenNthCalledWith(3, "private-test", "notebooks/");
    expect(listObjects).toHaveBeenNthCalledWith(4, "private-test", "quarantine/");
  });

  it("executa em modo de simulação por padrão sem excluir arquivos", async () => {
    const result = await service.execute();

    expect(result).toEqual({
      scanned: 4,
      referenced: 1,
      deleted: 0,
      skippedRecent: 2,
      eligibleForDeletion: 1,
      dryRun: true,
    });
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it("preserva arquivos referenciados, recentes e sem data de modificação", async () => {
    repository.listReferencedObjects.mockResolvedValueOnce([
      { bucketName: "public-test", storageKey: "media/referenced.webp" },
    ]);

    const result = await service.execute(false);

    expect(result.deleted).toBe(1);
    expect(deleteObject).toHaveBeenCalledOnce();
    expect(deleteObject).toHaveBeenCalledWith("media/orphan.webp", "public-test");
  });

  it("exclui arquivos órfãos somente quando a execução é confirmada", async () => {
    const result = await service.execute(false);

    expect(result.dryRun).toBe(false);
    expect(result.deleted).toBe(1);
    expect(deleteObject).toHaveBeenCalledWith("media/orphan.webp", "public-test");
  });

  it("limita a 500 exclusões por execução", async () => {
    listObjects.mockImplementation(async (bucketName: string, prefix: string) => {
      if (bucketName !== "public-test" || prefix !== "media/") return [];
      return Array.from({ length: 520 }, (_, index) => ({
        key: `media/orphan-${index}.webp`,
        sizeBytes: 100,
        lastModified: oldDate,
      }));
    });

    const result = await service.execute(false);

    expect(result.scanned).toBe(520);
    expect(result.eligibleForDeletion).toBe(500);
    expect(result.deleted).toBe(500);
    expect(deleteObject).toHaveBeenCalledTimes(500);
  });

  it("interrompe a execução quando uma exclusão falha", async () => {
    deleteObject.mockRejectedValueOnce(new Error("STORAGE_DELETE_FAILED"));

    await expect(service.execute(false)).rejects.toThrow("STORAGE_DELETE_FAILED");
    expect(deleteObject).toHaveBeenCalledOnce();
  });
});
