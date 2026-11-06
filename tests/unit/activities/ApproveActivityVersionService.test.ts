import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EntityManager } from "typeorm";
import { Activity } from "../../../src/modules/activities/entities/Activity";
import { ActivityVersion } from "../../../src/modules/activities/entities/ActivityVersion";
import { ApproveActivityVersionService } from "../../../src/modules/activities/services/ApproveActivityVersionService";
import type { IActivityRepository } from "../../../src/modules/activities/repositories/interfaces/IActivityRepository";
import type { IActivityVersionRepository } from "../../../src/modules/activities/repositories/interfaces/IActivityVersionRepository";
import { ActivityStatus } from "../../../src/modules/activities/types/ActivityStatus";
import { ActivityVersionStatus } from "../../../src/modules/activities/types/ActivityVersionStatus";

describe("ApproveActivityVersionService", () => {
  const manager = {} as EntityManager;
  const slug = "atividade-ciencias";

  let activity: Activity;
  let pendingVersion: ActivityVersion;
  let activityRepository: IActivityRepository;
  let versionRepository: IActivityVersionRepository;
  let saveActivity: ReturnType<typeof vi.fn>;
  let saveVersion: ReturnType<typeof vi.fn>;
  let service: ApproveActivityVersionService;

  beforeEach(() => {
    vi.clearAllMocks();

    activity = new Activity();
    activity.id = "activity-123";
    activity.teacherId = "teacher-123";
    activity.slug = slug;
    activity.status = ActivityStatus.DRAFT;
    activity.currentPublishedVersionId = null;
    activity.deletedAt = null;

    pendingVersion = new ActivityVersion();
    pendingVersion.id = "version-123";
    pendingVersion.activityId = activity.id;
    pendingVersion.versionNumber = 1;
    pendingVersion.status = ActivityVersionStatus.PENDING_REVIEW;
    pendingVersion.publishedAt = null;
    activity.versions = [pendingVersion];

    saveActivity = vi.fn().mockImplementation(async (_manager: EntityManager, value: Activity) => value);
    saveVersion = vi.fn().mockImplementation(async (_manager: EntityManager, value: ActivityVersion) => value);

    activityRepository = {
      findById: vi.fn(),
      listFavoriteIds: vi.fn(),
      findBySlug: vi.fn(),
      findBySlugWithVersions: vi.fn().mockResolvedValue(activity),
      findByIdAndTeacherId: vi.fn(),
      findBySlugAndTeacherId: vi.fn(),
      list: vi.fn(),
      save: saveActivity,
      updatePublishedVersion: vi.fn(),
    };
    versionRepository = {
      findById: vi.fn(),
      hasAudioStorageKeyReference: vi.fn(),
      findByIdAndActivityIdForUpdate: vi.fn(),
      findByActivityIdAndVersionNumber: vi.fn(),
      findByActivityId: vi.fn(),
      findByActivityIdAndStatus: vi.fn(),
      findLatestByActivityId: vi.fn(),
      save: saveVersion,
    };
    service = new ApproveActivityVersionService(manager, activityRepository, versionRepository);
  });

  it("publica a versão pendente e atualiza a atividade", async () => {
    const result = await service.execute({ slug });

    expect(result.activity).toBe(activity);
    expect(result.version).toBe(pendingVersion);
    expect(result.version.status).toBe(ActivityVersionStatus.PUBLISHED);
    expect(result.version.publishedAt).toBeInstanceOf(Date);
    expect(result.activity.status).toBe(ActivityStatus.PUBLISHED);
    expect(result.activity.currentPublishedVersionId).toBe(pendingVersion.id);
    expect(saveVersion).toHaveBeenCalledWith(manager, pendingVersion);
    expect(saveActivity).toHaveBeenCalledWith(manager, activity);
  });

  it("aprova a versão mais recente, sem alterar versões anteriores", async () => {
    const oldVersion = new ActivityVersion();
    oldVersion.id = "version-old";
    oldVersion.activityId = activity.id;
    oldVersion.versionNumber = 1;
    oldVersion.status = ActivityVersionStatus.PUBLISHED;
    pendingVersion.versionNumber = 2;
    activity.versions = [pendingVersion, oldVersion];

    await service.execute({ slug });

    expect(oldVersion.status).toBe(ActivityVersionStatus.PUBLISHED);
    expect(pendingVersion.status).toBe(ActivityVersionStatus.PUBLISHED);
    expect(saveVersion).toHaveBeenCalledOnce();
  });

  it("retorna 404 para atividade inexistente ou excluída", async () => {
    vi.mocked(activityRepository.findBySlugWithVersions).mockResolvedValueOnce(null);

    await expect(service.execute({ slug })).rejects.toMatchObject({
      code: "ACTIVITY_NOT_FOUND",
      statusCode: 404,
    });

    activity.deletedAt = new Date();
    await expect(service.execute({ slug })).rejects.toMatchObject({
      code: "ACTIVITY_NOT_FOUND",
      statusCode: 404,
    });

    expect(saveVersion).not.toHaveBeenCalled();
    expect(saveActivity).not.toHaveBeenCalled();
  });

  it("não aprova atividades arquivadas", async () => {
    activity.status = ActivityStatus.ARCHIVED;

    await expect(service.execute({ slug })).rejects.toMatchObject({
      code: "ACTIVITY_NOT_APPROVABLE",
      statusCode: 409,
    });

    expect(saveVersion).not.toHaveBeenCalled();
  });

  it("não aprova quando não existe versão ou quando ela não aguarda revisão", async () => {
    activity.versions = [];

    await expect(service.execute({ slug })).rejects.toMatchObject({
      code: "ACTIVITY_VERSION_NOT_FOUND",
      statusCode: 409,
    });

    activity.versions = [pendingVersion];
    pendingVersion.status = ActivityVersionStatus.DRAFT;

    await expect(service.execute({ slug })).rejects.toMatchObject({
      code: "ACTIVITY_VERSION_NOT_AWAITING_APPROVAL",
      statusCode: 409,
    });

    expect(saveVersion).not.toHaveBeenCalled();
    expect(saveActivity).not.toHaveBeenCalled();
  });
});
