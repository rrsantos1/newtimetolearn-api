import { describe, expect, it, vi } from "vitest";

import { Activity } from "../../../src/modules/activities/entities/Activity";
import { ActivityVersion } from "../../../src/modules/activities/entities/ActivityVersion";
import { GetActivityBySlugService } from "../../../src/modules/activities/services/GetActivityBySlugService";
import type { IActivityRepository } from "../../../src/modules/activities/repositories/interfaces/IActivityRepository";
import { ActivityStatus } from "../../../src/modules/activities/types/ActivityStatus";
import { ActivityType } from "../../../src/modules/activities/types/ActivityType";
import { ActivityDifficulty } from "../../../src/modules/activities/types/ActivityDifficulty";
import { ActivityVisibility } from "../../../src/modules/activities/types/ActivityVisibility";
import { ActivityVersionStatus } from "../../../src/modules/activities/types/ActivityVersionStatus";

function createPublishedVersion(
  activityId: string,
  id: string,
  versionNumber: number,
  content: Record<string, unknown>,
): ActivityVersion {
  const version = new ActivityVersion();
  version.id = id;
  version.activityId = activityId;
  version.versionNumber = versionNumber;
  version.name = `Versão ${versionNumber}`;
  version.description = null;
  version.difficulty = ActivityDifficulty.EASY;
  version.timeLimitSeconds = null;
  version.content = content;
  version.generatedData = null;
  version.status = ActivityVersionStatus.PUBLISHED;
  version.revision = 1;
  version.submittedAt = null;
  version.publishedAt = new Date("2026-11-01T12:00:00.000Z");
  version.reviewFeedback = null;
  return version;
}

function createActivity(
  type: ActivityType,
  visibility = ActivityVisibility.PUBLIC,
): Activity {
  const activity = new Activity();
  activity.id = "activity-123";
  activity.teacherId = "teacher-123";
  activity.slug = "atividade-publica";
  activity.type = type;
  activity.status = ActivityStatus.PUBLISHED;
  activity.visibility = visibility;
  activity.executionCount = 0;
  activity.currentPublishedVersionId = "version-published";
  activity.createdAt = new Date("2026-11-01T10:00:00.000Z");
  activity.updatedAt = new Date("2026-11-01T10:00:00.000Z");
  activity.deletedAt = null;
  activity.coverMediaAssetId = null;
  activity.coverMediaAsset = null;
  return activity;
}

function createRepository(activity: Activity | null): IActivityRepository {
  return {
    findById: vi.fn(),
    listFavoriteIds: vi.fn(),
    findBySlug: vi.fn(),
    findBySlugWithVersions: vi.fn().mockResolvedValue(activity),
    findByIdAndTeacherId: vi.fn(),
    findBySlugAndTeacherId: vi.fn(),
    list: vi.fn(),
    save: vi.fn(),
    updatePublishedVersion: vi.fn(),
  };
}

describe("GetActivityBySlugService - publicOnly", () => {
  const input = {
    slug: "atividade-publica",
    userId: "",
    isAdmin: false,
    publicOnly: true,
  };

  it("deve retornar somente a versão publicada para visitantes", async () => {
    const activity = createActivity(ActivityType.WORD_SEARCH);
    const published = createPublishedVersion(activity.id, "version-published", 1, {
      words: ["GATO", "CACHORRO"],
    });
    const draft = createPublishedVersion(activity.id, "version-draft", 2, {
      words: ["CONTEUDO PRIVADO"],
    });
    draft.status = ActivityVersionStatus.DRAFT;
    activity.versions = [published, draft];

    const repository = createRepository(activity);
    const service = new GetActivityBySlugService(repository);
    const result = await service.execute(input);

    expect(repository.findBySlugWithVersions).toHaveBeenCalledWith(input.slug);
    expect(result.isOwner).toBe(false);
    expect(result.visibility).toBe(ActivityVisibility.PUBLIC);
    expect(result.version.versionNumber).toBe(1);
    expect(result.version.content).toEqual({ words: ["GATO", "CACHORRO"] });
  });

  it("deve retornar 404 quando a atividade não estiver pública", async () => {
    const activity = createActivity(
      ActivityType.WORD_SEARCH,
      ActivityVisibility.AUTHENTICATED,
    );
    activity.versions = [
      createPublishedVersion(activity.id, "version-published", 1, {}),
    ];

    const service = new GetActivityBySlugService(createRepository(activity));

    await expect(service.execute(input)).rejects.toMatchObject({
      code: "ACTIVITY_NOT_FOUND",
      statusCode: 404,
    });
  });

  it("deve retornar 404 quando a atividade não estiver aprovada", async () => {
    const activity = createActivity(ActivityType.WORD_SEARCH);
    activity.status = ActivityStatus.DRAFT;
    activity.versions = [
      createPublishedVersion(activity.id, "version-published", 1, {}),
    ];

    const service = new GetActivityBySlugService(createRepository(activity));

    await expect(service.execute(input)).rejects.toMatchObject({
      code: "ACTIVITY_NOT_FOUND",
      statusCode: 404,
    });
  });

  it("deve ocultar as respostas esperadas da atividade Listening", async () => {
    const activity = createActivity(ActivityType.LISTENING);
    const version = createPublishedVersion(activity.id, "version-published", 1, {
      passages: [
        {
          id: "passage-1",
          audio: { status: "READY", storageKey: "audio/test.mp3" },
          blanks: [
            {
              id: "blank-1",
              expectedAnswer: "elefante",
              alternatives: ["elefante", "girafa"],
              position: 1,
            },
          ],
        },
      ],
    });
    activity.versions = [version];

    const service = new GetActivityBySlugService(createRepository(activity));
    const result = await service.execute(input);
    const passages = result.version.content.passages as Array<{
      blanks: Array<Record<string, unknown>>;
    }>;

    expect(passages[0].blanks[0]).toEqual({
      id: "blank-1",
      position: 1,
    });
    expect(passages[0].blanks[0]).not.toHaveProperty("expectedAnswer");
    expect(passages[0].blanks[0]).not.toHaveProperty("alternatives");
  });

  it("deve substituir os identificadores de pares por tokens de execução", async () => {
    const activity = createActivity(ActivityType.WORD_MATCHING);
    const version = createPublishedVersion(activity.id, "version-published", 1, {
      pairs: [
        {
          id: "pair-secret-id",
          source: { id: "source-secret", text: "Gato" },
          target: { id: "target-secret", text: "Cat" },
        },
      ],
    });
    activity.versions = [version];

    const service = new GetActivityBySlugService(createRepository(activity));
    const result = await service.execute(input);
    const pairs = result.version.content.pairs as Array<{
      source: { id: string; text: string };
      target: { id: string; text: string };
    }>;

    expect(pairs[0].source.id).not.toBe("source-secret");
    expect(pairs[0].target.id).not.toBe("target-secret");
    expect(pairs[0].source.text).toBe("Gato");
    expect(pairs[0].target.text).toBe("Cat");
  });
});
