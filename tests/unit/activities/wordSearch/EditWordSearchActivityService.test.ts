import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EntityManager } from "typeorm";
import { Activity } from "../../../../src/modules/activities/entities/Activity";
import { ActivityVersion } from "../../../../src/modules/activities/entities/ActivityVersion";
import { EditWordSearchActivityService } from "../../../../src/modules/activities/services/EditWordSearchActivityService";
import type { IActivityRepository } from "../../../../src/modules/activities/repositories/interfaces/IActivityRepository";
import type { IActivityVersionRepository } from "../../../../src/modules/activities/repositories/interfaces/IActivityVersionRepository";
import { ActivityDifficulty } from "../../../../src/modules/activities/types/ActivityDifficulty";
import { ActivityStatus } from "../../../../src/modules/activities/types/ActivityStatus";
import { ActivityType } from "../../../../src/modules/activities/types/ActivityType";
import { ActivityVersionStatus } from "../../../../src/modules/activities/types/ActivityVersionStatus";
import { ActivityVisibility } from "../../../../src/modules/activities/types/ActivityVisibility";

describe("EditWordSearchActivityService", () => {
  let activity: Activity;
  let publishedVersion: ActivityVersion;
  let activityRepository: IActivityRepository;
  let versionRepository: IActivityVersionRepository;
  let saveVersion: ReturnType<typeof vi.fn>;
  let updatePublishedVersion: ReturnType<typeof vi.fn>;

  const slug = "animais-brasileiros";
  const teacherId = "teacher-123";

  const resetFixture = (): void => {
    activity = new Activity();
    activity.id = "activity-123";
    activity.teacherId = teacherId;
    activity.slug = slug;
    activity.type = ActivityType.WORD_SEARCH;
    activity.status = ActivityStatus.DRAFT;
    activity.visibility = ActivityVisibility.AUTHENTICATED;
    activity.executionCount = 0;
    activity.currentPublishedVersionId = null;
    activity.deletedAt = null;

    publishedVersion = new ActivityVersion();
    publishedVersion.id = "version-1";
    publishedVersion.activityId = activity.id;
    publishedVersion.versionNumber = 1;
    publishedVersion.name = "Caça-palavras";
    publishedVersion.description = null;
    publishedVersion.difficulty = ActivityDifficulty.EASY;
    publishedVersion.timeLimitSeconds = 900;
    publishedVersion.content = { words: ["GATO", "CACHORRO", "LEAO"] };
    publishedVersion.generatedData = {};
    publishedVersion.status = ActivityVersionStatus.PUBLISHED;
    publishedVersion.revision = 1;
    publishedVersion.submittedAt = null;
    publishedVersion.publishedAt = new Date();
    publishedVersion.reviewFeedback = null;
    publishedVersion.reviewedAt = null;
    activity.versions = [publishedVersion];

    saveVersion = vi.fn().mockImplementation(async (_manager: EntityManager, version: ActivityVersion) => {
      if (!version.id) version.id = "version-new";
      return version;
    });
    updatePublishedVersion = vi.fn().mockResolvedValue(undefined);

    activityRepository = {
      findBySlugWithVersions: vi.fn().mockResolvedValue(activity),
      updatePublishedVersion,
    } as unknown as IActivityRepository;
    versionRepository = { save: saveVersion } as unknown as IActivityVersionRepository;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetFixture();
  });

  const input = {
    slug,
    teacherId,
    isAdmin: false,
    name: "  Animais revisados  ",
    description: "  Encontre os animais  ",
    difficulty: ActivityDifficulty.MEDIUM,
    words: ["GATO", "CACHORRO", "LEÃO"],
  };

  it("edits an existing draft and regenerates its grid", async () => {
    const draft = new ActivityVersion();
    Object.assign(draft, publishedVersion, {
      id: "version-draft",
      status: ActivityVersionStatus.DRAFT,
      revision: 2,
    });
    activity.versions = [publishedVersion, draft];

    const result = await new EditWordSearchActivityService(
      {} as EntityManager, activityRepository, versionRepository,
    ).execute(input);

    expect(result.version).toBe(draft);
    expect(result.version).toMatchObject({
      name: "Animais revisados",
      description: "Encontre os animais",
      difficulty: ActivityDifficulty.MEDIUM,
      revision: 3,
      status: ActivityVersionStatus.DRAFT,
      content: { words: ["GATO", "CACHORRO", "LEÃO"] },
    });
    expect(result.preview.words).toEqual(["GATO", "CACHORRO", "LEÃO"]);
    expect(result.preview.grid.length).toBeGreaterThan(0);
    expect(result.version.generatedData).toMatchObject({
      grid: expect.any(Array),
      wordPositions: expect.any(Array),
    });
  });

  it("creates a new version after publication and applies the default time limit", async () => {
    const result = await new EditWordSearchActivityService(
      {} as EntityManager, activityRepository, versionRepository,
    ).execute(input);

    expect(result.version).not.toBe(publishedVersion);
    expect(result.version).toMatchObject({
      activityId: activity.id,
      versionNumber: 2,
      revision: 1,
      status: ActivityVersionStatus.DRAFT,
      timeLimitSeconds: 900,
    });
  });

  it("publishes an edited version immediately for an administrator", async () => {
    const result = await new EditWordSearchActivityService(
      {} as EntityManager, activityRepository, versionRepository,
    ).execute({ ...input, isAdmin: true, timeLimitSeconds: 600 });

    expect(result.version.status).toBe(ActivityVersionStatus.PUBLISHED);
    expect(result.version.timeLimitSeconds).toBe(600);
    expect(result.version.publishedAt).toBeInstanceOf(Date);
    expect(updatePublishedVersion).toHaveBeenCalledWith({}, activity.id, result.version.id);
    expect(activity.currentPublishedVersionId).toBe(result.version.id);
  });

  it("rejects edits for another owner, unsupported activity types and archived activities", async () => {
    const service = new EditWordSearchActivityService(
      {} as EntityManager, activityRepository, versionRepository,
    );

    await expect(service.execute({ ...input, teacherId: "other-teacher" })).rejects.toMatchObject({
      code: "ACTIVITY_NOT_FOUND",
      statusCode: 404,
    });
    activity.type = ActivityType.QUIZ;
    await expect(service.execute(input)).rejects.toMatchObject({
      code: "ACTIVITY_TYPE_NOT_SUPPORTED",
      statusCode: 422,
    });
    activity.type = ActivityType.WORD_SEARCH;
    activity.status = ActivityStatus.ARCHIVED;
    await expect(service.execute(input)).rejects.toMatchObject({
      code: "ACTIVITY_NOT_EDITABLE",
      statusCode: 409,
    });
    expect(saveVersion).not.toHaveBeenCalled();
  });

  it("blocks edits while a version is awaiting review and rejects invalid words", async () => {
    const service = new EditWordSearchActivityService(
      {} as EntityManager, activityRepository, versionRepository,
    );
    publishedVersion.status = ActivityVersionStatus.PENDING_REVIEW;

    await expect(service.execute(input)).rejects.toMatchObject({
      code: "ACTIVITY_VERSION_PENDING_REVIEW",
      statusCode: 409,
    });
    publishedVersion.status = ActivityVersionStatus.PUBLISHED;

    await expect(service.execute({ ...input, words: ["GATO", "GATO"] })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      statusCode: 400,
    });
    expect(saveVersion).not.toHaveBeenCalled();
  });
});
