import { describe, expect, it, vi } from "vitest";

import { Activity } from "../../../src/modules/activities/entities/Activity";
import { ActivityVersion } from "../../../src/modules/activities/entities/ActivityVersion";
import { ListActivitiesService } from "../../../src/modules/activities/services/ListActivitiesService";
import type { IActivityRepository } from "../../../src/modules/activities/repositories/interfaces/IActivityRepository";
import { ActivityDifficulty } from "../../../src/modules/activities/types/ActivityDifficulty";
import { ActivityStatus } from "../../../src/modules/activities/types/ActivityStatus";
import { ActivityType } from "../../../src/modules/activities/types/ActivityType";
import { ActivityVersionStatus } from "../../../src/modules/activities/types/ActivityVersionStatus";
import { ActivityVisibility } from "../../../src/modules/activities/types/ActivityVisibility";

function createVersion(
  id: string,
  versionNumber: number,
  name: string,
  status: ActivityVersionStatus,
): ActivityVersion {
  const version = new ActivityVersion();
  version.id = id;
  version.activityId = "activity-123";
  version.versionNumber = versionNumber;
  version.name = name;
  version.description = null;
  version.difficulty = ActivityDifficulty.EASY;
  version.timeLimitSeconds = null;
  version.content = {};
  version.status = status;
  version.revision = 1;
  return version;
}

describe("ListActivitiesService", () => {
  it("não expõe versões não publicadas no escopo explore", async () => {
    const publishedVersion = createVersion(
      "version-published",
      1,
      "Atividade publicada",
      ActivityVersionStatus.PUBLISHED,
    );
    const draftVersion = createVersion(
      "version-draft",
      2,
      "Rascunho privado",
      ActivityVersionStatus.DRAFT,
    );

    const activity = new Activity();
    activity.id = "activity-123";
    activity.teacherId = "another-teacher";
    activity.slug = "atividade-compartilhada";
    activity.type = ActivityType.WORD_SEARCH;
    activity.status = ActivityStatus.PUBLISHED;
    activity.visibility = ActivityVisibility.AUTHENTICATED;
    activity.executionCount = 0;
    activity.createdAt = new Date();
    activity.currentPublishedVersionId = publishedVersion.id;
    activity.deletedAt = null;
    activity.versions = [publishedVersion, draftVersion];

    const activityRepository: IActivityRepository = {
      findById: vi.fn(),
      findBySlug: vi.fn(),
      findBySlugWithVersions: vi.fn(),
      findByIdAndTeacherId: vi.fn(),
      findBySlugAndTeacherId: vi.fn(),
      list: vi.fn().mockResolvedValue({
        items: [activity],
        total: 1,
      }),
      save: vi.fn(),
      updatePublishedVersion: vi.fn(),
    };

    const service = new ListActivitiesService(activityRepository);
    const result = await service.execute({
      page: 1,
      limit: 20,
      teacherId: "current-teacher",
      scope: "explore",
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].latestVersion?.name).toBe(
      "Atividade publicada",
    );
    expect(result.items[0].publishedVersion?.name).toBe(
      "Atividade publicada",
    );
    expect(result.items[0].latestVersion?.status).toBe(
      ActivityVersionStatus.PUBLISHED,
    );
  });
});
