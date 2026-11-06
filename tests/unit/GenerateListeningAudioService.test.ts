import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EntityManager } from "typeorm";
import type { IActivityRepository } from "../../src/modules/activities/repositories/interfaces/IActivityRepository";
import type { IActivityVersionRepository } from "../../src/modules/activities/repositories/interfaces/IActivityVersionRepository";
import type { StorageUsageRepository } from "../../src/shared/storage/repositories/StorageUsageRepository";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  findBySlugWithVersions: vi.fn(),
  hasAudioStorageKeyReference: vi.fn(),
  findByIdAndActivityIdForUpdate: vi.fn(),
  saveVersion: vi.fn(),
  getUsage: vi.fn(),
  uploadObject: vi.fn(),
  deleteObject: vi.fn(),
}));

vi.mock("../../src/shared/config/env", () => ({
  env: {
    OPENAI_API_KEY: "test-openai-key",
    OPENAI_TTS_MODEL: "gpt-4o-mini-tts",
    B2_BUCKET_NAME: "media-test",
    B2_PUBLIC_BASE_URL: "https://cdn.example.test",
    TEACHER_STORAGE_LIMIT_BYTES: 1024,
  },
}));

vi.mock("../../src/shared/database/data-source", () => ({
  AppDataSource: { transaction: mocks.transaction },
}));

vi.mock("../../src/shared/storage/storageFactory", () => ({
  makeStorageProvider: () => ({
    uploadObject: mocks.uploadObject,
    deleteObject: mocks.deleteObject,
  }),
}));

import { GenerateListeningAudioService } from "../../src/modules/activities/services/GenerateListeningAudioService";
import { ActivityType } from "../../src/modules/activities/types/ActivityType";
import { ActivityVersionStatus } from "../../src/modules/activities/types/ActivityVersionStatus";

describe("GenerateListeningAudioService", () => {
  const teacherId = "teacher-123";
  const audioBuffer = Buffer.from("audio-content");
  const audioBase64 = audioBuffer.toString("base64");

  let activityRepository: IActivityRepository;
  let versionRepository: IActivityVersionRepository;
  let storageUsageRepository: StorageUsageRepository;
  let service: GenerateListeningAudioService;
  let activity: {
    id: string;
    teacherId: string;
    slug: string;
    type: ActivityType;
    deletedAt: null;
    versions: Array<{
      id: string;
      activityId: string;
      versionNumber: number;
      status: ActivityVersionStatus;
      content: Record<string, unknown>;
    }>;
  };
  let version: {
    id: string;
    activityId: string;
    versionNumber: number;
    status: ActivityVersionStatus;
    content: Record<string, unknown>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    version = {
      id: "version-123",
      activityId: "activity-123",
      versionNumber: 1,
      status: ActivityVersionStatus.DRAFT,
      content: {
        language: "pt-BR",
        passages: [{
          id: "passage-1",
          text: "O gato corre.",
          blanks: [],
          audio: {
            storageKey: null,
            publicUrl: null,
            status: "PENDING",
            sizeBytes: null,
          },
        }],
      },
    };
    activity = {
      id: "activity-123",
      teacherId,
      slug: "listening-animais",
      type: ActivityType.LISTENING,
      deletedAt: null,
      versions: [version],
    };

    mocks.findBySlugWithVersions.mockResolvedValue(activity);
    mocks.hasAudioStorageKeyReference.mockResolvedValue(false);
    mocks.findByIdAndActivityIdForUpdate.mockImplementation(async () => version);
    mocks.saveVersion.mockImplementation(async (_manager: EntityManager, savedVersion: typeof version) => savedVersion);
    mocks.getUsage.mockResolvedValue(0);
    mocks.uploadObject.mockResolvedValue(undefined);
    mocks.deleteObject.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation(async (callback: (manager: EntityManager) => Promise<unknown>) => callback({} as EntityManager));

    activityRepository = {
      findById: vi.fn(),
      listFavoriteIds: vi.fn(),
      findBySlug: vi.fn(),
      findBySlugWithVersions: mocks.findBySlugWithVersions,
      findByIdAndTeacherId: vi.fn(),
      findBySlugAndTeacherId: vi.fn(),
      list: vi.fn(),
      save: vi.fn(),
      updatePublishedVersion: vi.fn(),
    };
    versionRepository = {
      findById: vi.fn(),
      hasAudioStorageKeyReference: mocks.hasAudioStorageKeyReference,
      findByIdAndActivityIdForUpdate: mocks.findByIdAndActivityIdForUpdate,
      findByActivityIdAndVersionNumber: vi.fn(),
      findByActivityId: vi.fn(),
      findByActivityIdAndStatus: vi.fn(),
      findLatestByActivityId: vi.fn(),
      save: mocks.saveVersion,
    };
    storageUsageRepository = {
      isAdminUser: vi.fn(),
      getUsageByTeacherId: mocks.getUsage,
      listReferencedObjects: vi.fn(),
    };

    service = new GenerateListeningAudioService(
      activityRepository,
      versionRepository,
      storageUsageRepository,
      { getForTeacher: vi.fn().mockResolvedValue({ storageLimitBytes: 1024 }) } as never,
    );
  });

  it("impede salvar áudio quando a cota projetada é excedida", async () => {
    mocks.getUsage.mockResolvedValue(1_020);

    await expect(service.execute({
      slug: activity.slug,
      passageId: "passage-1",
      teacherId,
      voice: "coral",
      audioBase64,
    })).rejects.toMatchObject({
      code: "STORAGE_QUOTA_EXCEEDED",
      statusCode: 413,
    });

    expect(mocks.uploadObject).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("permite que administradores salvem áudio mesmo acima da cota", async () => {
    mocks.getUsage.mockResolvedValue(10_000);

    const result = await service.execute({
      slug: activity.slug,
      passageId: "passage-1",
      teacherId,
      voice: "coral",
      audioBase64,
      isAdmin: true,
    });

    expect(mocks.getUsage).toHaveBeenCalledWith(teacherId);
    expect(mocks.uploadObject).toHaveBeenCalledOnce();
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      passageId: "passage-1",
      reused: false,
      audio: {
        status: "READY",
        storageKey: expect.stringMatching(/^audio\/listening\//),
        sizeBytes: audioBuffer.byteLength,
        voice: "coral",
      },
    });
  });

  it("não remove um áudio anterior que ainda é compartilhado por outra versão", async () => {
    const previousKey = "audio/listening/shared.mp3";
    const passages = version.content.passages as Array<{
      id: string;
      text: string;
      blanks: unknown[];
      audio: Record<string, unknown>;
    }>;
    const passage = passages[0];
    if (!passage) throw new Error("Fixture de Listening inválida");
    passage.audio = {
      storageKey: previousKey,
      publicUrl: "https://cdn.example.test/audio/listening/shared.mp3",
      status: "READY",
      model: "gpt-4o-mini-tts",
      voice: "coral",
      textHash: "old-hash",
      sizeBytes: 12,
    };
    mocks.hasAudioStorageKeyReference.mockResolvedValue(true);

    await service.execute({
      slug: activity.slug,
      passageId: "passage-1",
      teacherId,
      voice: "coral",
      audioBase64,
    });

    expect(mocks.hasAudioStorageKeyReference).toHaveBeenCalledWith(previousKey, version.id);
    expect(mocks.deleteObject).not.toHaveBeenCalled();
  });
});
