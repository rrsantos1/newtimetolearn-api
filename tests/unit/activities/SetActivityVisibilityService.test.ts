import type { EntityManager } from "typeorm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Activity } from "../../../src/modules/activities/entities/Activity";
import { ActivityVersion } from "../../../src/modules/activities/entities/ActivityVersion";
import { SetActivityVisibilityService } from "../../../src/modules/activities/services/SetActivityVisibilityService";
import type { IActivityRepository } from "../../../src/modules/activities/repositories/interfaces/IActivityRepository";
import { ActivityStatus } from "../../../src/modules/activities/types/ActivityStatus";
import { ActivityType } from "../../../src/modules/activities/types/ActivityType";
import { ActivityDifficulty } from "../../../src/modules/activities/types/ActivityDifficulty";
import { ActivityVisibility } from "../../../src/modules/activities/types/ActivityVisibility";
import { ActivityVersionStatus } from "../../../src/modules/activities/types/ActivityVersionStatus";

describe("SetActivityVisibilityService", () => {
  let service: SetActivityVisibilityService;
  let manager: EntityManager;
  let activityRepository: IActivityRepository;
  let activity: Activity;
  let publishedVersion: ActivityVersion;

  const input = {
    slug: "animais-brasileiros",
    visibility: ActivityVisibility.PUBLIC,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();

    manager = {} as EntityManager;

    publishedVersion = new ActivityVersion();
    publishedVersion.id = "version-published";
    publishedVersion.activityId = "activity-123";
    publishedVersion.versionNumber = 1;
    publishedVersion.name = "Animais brasileiros";
    publishedVersion.description = null;
    publishedVersion.difficulty = ActivityDifficulty.EASY;
    publishedVersion.timeLimitSeconds = null;
    publishedVersion.content = {};
    publishedVersion.status = ActivityVersionStatus.PUBLISHED;
    publishedVersion.revision = 1;

    activity = new Activity();
    activity.id = "activity-123";
    activity.teacherId = "teacher-123";
    activity.slug = input.slug;
    activity.type = ActivityType.WORD_SEARCH;
    activity.status = ActivityStatus.PUBLISHED;
    activity.visibility = ActivityVisibility.AUTHENTICATED;
    activity.currentPublishedVersionId = publishedVersion.id;
    activity.deletedAt = null;
    activity.versions = [publishedVersion];

    activityRepository = {
      findById: vi.fn(),
      listFavoriteIds: vi.fn(),
      findBySlug: vi.fn(),
      findBySlugWithVersions: vi.fn().mockResolvedValue(activity),
      findByIdAndTeacherId: vi.fn(),
      findBySlugAndTeacherId: vi.fn(),
      list: vi.fn(),
      save: vi.fn().mockImplementation(
        async (_manager: EntityManager, savedActivity: Activity) => savedActivity,
      ),
      updatePublishedVersion: vi.fn(),
    };

    service = new SetActivityVisibilityService(manager, activityRepository);
  });

  it("deve disponibilizar publicamente uma atividade aprovada", async () => {
    const result = await service.execute(input);

    expect(result).toEqual({
      slug: input.slug,
      visibility: ActivityVisibility.PUBLIC,
    });
    expect(activity.visibility).toBe(ActivityVisibility.PUBLIC);
    expect(activityRepository.save).toHaveBeenCalledWith(manager, activity);
  });

  it("deve permitir voltar uma atividade para acesso autenticado", async () => {
    activity.visibility = ActivityVisibility.PUBLIC;

    const result = await service.execute({
      ...input,
      visibility: ActivityVisibility.AUTHENTICATED,
    });

    expect(result.visibility).toBe(ActivityVisibility.AUTHENTICATED);
    expect(activityRepository.save).toHaveBeenCalledOnce();
  });

  it("deve rejeitar uma atividade inexistente", async () => {
    vi.mocked(activityRepository.findBySlugWithVersions).mockResolvedValueOnce(null);

    await expect(service.execute(input)).rejects.toMatchObject({
      code: "ACTIVITY_NOT_FOUND",
      statusCode: 404,
    });

    expect(activityRepository.save).not.toHaveBeenCalled();
  });

  it("deve rejeitar uma atividade excluída", async () => {
    activity.deletedAt = new Date();

    await expect(service.execute(input)).rejects.toMatchObject({
      code: "ACTIVITY_NOT_FOUND",
      statusCode: 404,
    });

    expect(activityRepository.save).not.toHaveBeenCalled();
  });

  it("deve impedir a publicação pública de uma atividade não aprovada", async () => {
    activity.status = ActivityStatus.DRAFT;

    await expect(service.execute(input)).rejects.toMatchObject({
      code: "ACTIVITY_NOT_PUBLISHED",
      statusCode: 409,
    });

    expect(activityRepository.save).not.toHaveBeenCalled();
  });

  it("deve rejeitar uma atividade sem versão publicada válida", async () => {
    activity.currentPublishedVersionId = "missing-version";

    await expect(service.execute(input)).rejects.toMatchObject({
      code: "ACTIVITY_NOT_PUBLISHED",
      statusCode: 409,
    });

    expect(activityRepository.save).not.toHaveBeenCalled();
  });

  it("deve propagar falhas ao persistir a visibilidade", async () => {
    vi.mocked(activityRepository.save).mockRejectedValueOnce(
      new Error("Falha ao salvar visibilidade"),
    );

    await expect(service.execute(input)).rejects.toThrow(
      "Falha ao salvar visibilidade",
    );
  });
});
