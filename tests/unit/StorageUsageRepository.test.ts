import { beforeEach, describe, expect, it, vi } from "vitest";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("../../src/shared/database/data-source", () => ({
  AppDataSource: { query },
}));

vi.mock("../../src/shared/config/env", () => ({
  env: {
    B2_QUARANTINE_BUCKET_NAME: "private-test",
    B2_BUCKET_NAME: "public-test",
  },
}));

import { StorageUsageRepository } from "../../src/shared/storage/repositories/StorageUsageRepository";

describe("StorageUsageRepository", () => {
  const repository = new StorageUsageRepository();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("identifica administradores usando a associação de papéis", async () => {
    query.mockResolvedValueOnce([{ is_admin: true }]);

    await expect(repository.isAdminUser("admin-123")).resolves.toBe(true);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("role.code = 'ADMIN'"),
      ["admin-123"],
    );
  });

  it("retorna false quando o usuário não é administrador", async () => {
    query.mockResolvedValueOnce([{ is_admin: false }]);

    await expect(repository.isAdminUser("teacher-123")).resolves.toBe(false);
  });

  it("retorna false quando a consulta não encontra uma linha", async () => {
    query.mockResolvedValueOnce([]);

    await expect(repository.isAdminUser("unknown-123")).resolves.toBe(false);
  });

  it("soma o consumo consolidado das quatro origens e deduplica objetos por bucket e chave", async () => {
    query.mockResolvedValueOnce([{ total: "987654" }]);

    await expect(repository.getUsageByTeacherId("teacher-123")).resolves.toBe(987654);

    const [sql, parameters] = query.mock.calls[0] as [string, string[]];
    expect(sql).toContain("public.media_assets");
    expect(sql).toContain("thumbnail_storage_key");
    expect(sql).toContain("public.notebook_entries");
    expect(sql).toContain("public.activity_versions");
    expect(sql).toContain("GROUP BY bucket_name, storage_key");
    expect(sql).toContain("MAX(size_bytes)");
    expect(parameters).toEqual(["teacher-123", "private-test", "public-test"]);
  });

  it("considera zero quando não existem objetos contabilizados", async () => {
    query.mockResolvedValueOnce([{ total: "0" }]);

    await expect(repository.getUsageByTeacherId("teacher-123")).resolves.toBe(0);
  });

  it("retorna as referências de arquivos públicos e privados sem duplicações", async () => {
    const references = [
      { bucketName: "public-test", storageKey: "media/image.webp" },
      { bucketName: "public-test", storageKey: "audio/listening/audio.mp3" },
      { bucketName: "private-test", storageKey: "notebooks/file.pdf" },
    ];
    query.mockResolvedValueOnce(references);

    await expect(repository.listReferencedObjects()).resolves.toEqual(references);

    const [sql, parameters] = query.mock.calls[0] as [string, string[]];
    expect(sql).toContain("SELECT DISTINCT bucket_name");
    expect(sql).toContain("public.media_assets");
    expect(sql).toContain("thumbnail_storage_key");
    expect(sql).toContain("public.notebook_entries");
    expect(sql).toContain("public.activity_versions");
    expect(parameters).toEqual(["private-test", "public-test"]);
  });
});
