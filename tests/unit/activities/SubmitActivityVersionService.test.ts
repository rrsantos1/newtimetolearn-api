import type { EntityManager } from "typeorm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Activity } from "../../../src/modules/activities/entities/Activity";
import { ActivityVersion } from "../../../src/modules/activities/entities/ActivityVersion";
import { SubmitActivityVersionService } from "../../../src/modules/activities/services/SubmitActivityVersionService";
import { ActivityStatus } from "../../../src/modules/activities/types/ActivityStatus";
import { ActivityVersionStatus } from "../../../src/modules/activities/types/ActivityVersionStatus";
import type { IActivityRepository } from "../../../src/modules/activities/repositories/interfaces/IActivityRepository";
import type { IActivityVersionRepository } from "../../../src/modules/activities/repositories/interfaces/IActivityVersionRepository";

describe("SubmitActivityVersionService", () => {
  let service: SubmitActivityVersionService;
  let activityRepository: IActivityRepository;
  let activityVersionRepository: IActivityVersionRepository;
  let manager: EntityManager;

  let activity: Activity;
  let draftVersion: ActivityVersion;

  const input = {
    slug: "animais-brasileiros",
    teacherId: "teacher-123",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();

    manager = {} as EntityManager;

    activity = new Activity();
    activity.id = "activity-123";
    activity.teacherId = input.teacherId;
    activity.slug = input.slug;
    activity.status = ActivityStatus.DRAFT;
    activity.currentPublishedVersionId = null;
    activity.deletedAt = null;

    draftVersion = new ActivityVersion();
    draftVersion.id = "version-123";
    draftVersion.activityId = activity.id;
    draftVersion.versionNumber = 1;
    draftVersion.status = ActivityVersionStatus.DRAFT;
    draftVersion.submittedAt = null;
    draftVersion.publishedAt = null;
    draftVersion.reviewFeedback = null;
    draftVersion.reviewedAt = null;

    activity.versions = [draftVersion];

    activityRepository = {
      findById: vi.fn(),
      findBySlug: vi.fn(),
      findBySlugWithVersions: vi.fn().mockImplementation(
        async () => activity,
      ),
      findByIdAndTeacherId: vi.fn(),
      findBySlugAndTeacherId: vi.fn(),
      list: vi.fn(),
      save: vi.fn(),
    };

    activityVersionRepository = {
      findById: vi.fn(),
      findByActivityIdAndVersionNumber: vi.fn(),
      findByActivityId: vi.fn(),
      findByActivityIdAndStatus: vi.fn(),
      findLatestByActivityId: vi.fn(),
      save: vi.fn().mockImplementation(
        async (
          _manager: EntityManager,
          version: ActivityVersion,
        ) => version,
      ),
    };

    service = new SubmitActivityVersionService(
      manager,
      activityRepository,
      activityVersionRepository,
    );
  });

  it("deve enviar a versão mais recente em rascunho para revisão", async () => {
    const result = await service.execute(input);

    expect(result.activity).toBe(activity);
    expect(result.version).toBe(draftVersion);

    expect(result.version.status).toBe(
      ActivityVersionStatus.PENDING_REVIEW,
    );

    expect(result.version.submittedAt).toBeInstanceOf(Date);

    expect(result.version.reviewFeedback).toBeNull();
    expect(result.version.reviewedAt).toBeNull();

    expect(
      activityRepository.findBySlugWithVersions,
    ).toHaveBeenCalledWith(input.slug);

    expect(activityVersionRepository.save).toHaveBeenCalledOnce();
    expect(activityVersionRepository.save).toHaveBeenCalledWith(
      manager,
      draftVersion,
    );
  });

  it("deve preservar o status da atividade ao enviar uma versão para revisão", async () => {
    const result = await service.execute(input);

    expect(result.activity.status).toBe(ActivityStatus.DRAFT);
    expect(result.activity.currentPublishedVersionId).toBeNull();

    expect(activityRepository.save).not.toHaveBeenCalled();
  });

  it("deve preservar a versão publicada enquanto uma nova versão aguarda revisão", async () => {
    activity.status = ActivityStatus.PUBLISHED;
    activity.currentPublishedVersionId = "published-version-1";

    const publishedVersion = new ActivityVersion();
    publishedVersion.id = "published-version-1";
    publishedVersion.activityId = activity.id;
    publishedVersion.versionNumber = 1;
    publishedVersion.status = ActivityVersionStatus.PUBLISHED;

    draftVersion.id = "version-2";
    draftVersion.versionNumber = 2;
    draftVersion.status = ActivityVersionStatus.DRAFT;

    activity.versions = [publishedVersion, draftVersion];

    const result = await service.execute(input);

    expect(result.version.status).toBe(
      ActivityVersionStatus.PENDING_REVIEW,
    );

    expect(result.activity.status).toBe(ActivityStatus.PUBLISHED);
    expect(result.activity.currentPublishedVersionId).toBe(
      "published-version-1",
    );

    expect(publishedVersion.status).toBe(
      ActivityVersionStatus.PUBLISHED,
    );

    expect(activityRepository.save).not.toHaveBeenCalled();
  });

  it("deve lançar erro quando a atividade não existir", async () => {
    vi.mocked(
      activityRepository.findBySlugWithVersions,
    ).mockResolvedValueOnce(null);

    await expect(service.execute(input)).rejects.toMatchObject({
      code: "ACTIVITY_NOT_FOUND",
      statusCode: 404,
    });

    expect(activityVersionRepository.save).not.toHaveBeenCalled();
  });

  it("deve impedir a submissão de atividade excluída", async () => {
    activity.deletedAt = new Date();

    await expect(service.execute(input)).rejects.toMatchObject({
      code: "ACTIVITY_NOT_FOUND",
      statusCode: 404,
    });

    expect(activityVersionRepository.save).not.toHaveBeenCalled();
  });

  it("deve impedir que um professor envie a atividade de outro professor", async () => {
    activity.teacherId = "another-teacher";

    await expect(service.execute(input)).rejects.toMatchObject({
      code: "ACTIVITY_NOT_FOUND",
      statusCode: 404,
    });

    expect(activityVersionRepository.save).not.toHaveBeenCalled();
  });

  it("deve impedir a submissão de atividades arquivadas", async () => {
    activity.status = ActivityStatus.ARCHIVED;

    await expect(service.execute(input)).rejects.toMatchObject({
      code: "ACTIVITY_NOT_SUBMITTABLE",
      statusCode: 409,
    });

    expect(activityVersionRepository.save).not.toHaveBeenCalled();
  });

  it("deve lançar erro quando a atividade não possuir versões", async () => {
    activity.versions = [];

    await expect(service.execute(input)).rejects.toMatchObject({
      code: "ACTIVITY_VERSION_NOT_FOUND",
      statusCode: 409,
    });

    expect(activityVersionRepository.save).not.toHaveBeenCalled();
  });

  it.each([
    ActivityVersionStatus.PENDING_REVIEW,
    ActivityVersionStatus.PUBLISHED,
    ActivityVersionStatus.REJECTED,
    ActivityVersionStatus.CHANGES_REQUESTED,
  ])(
    "deve impedir a submissão quando a versão mais recente estiver em %s",
    async (status) => {
      draftVersion.status = status;

      await expect(service.execute(input)).rejects.toMatchObject({
        code: "ACTIVITY_VERSION_NOT_SUBMITTABLE",
        statusCode: 409,
      });

      expect(activityVersionRepository.save).not.toHaveBeenCalled();
    },
  );

  it("deve validar a versão mais recente, mesmo que uma versão anterior esteja em rascunho", async () => {
    const olderDraft = new ActivityVersion();
    olderDraft.id = "version-1";
    olderDraft.activityId = activity.id;
    olderDraft.versionNumber = 1;
    olderDraft.status = ActivityVersionStatus.DRAFT;

    const latestVersion = new ActivityVersion();
    latestVersion.id = "version-2";
    latestVersion.activityId = activity.id;
    latestVersion.versionNumber = 2;
    latestVersion.status = ActivityVersionStatus.PENDING_REVIEW;

    activity.versions = [olderDraft, latestVersion];

    await expect(service.execute(input)).rejects.toMatchObject({
      code: "ACTIVITY_VERSION_NOT_SUBMITTABLE",
      statusCode: 409,
    });

    expect(activityVersionRepository.save).not.toHaveBeenCalled();
  });

  it("deve propagar o erro caso não consiga salvar a versão", async () => {
    vi.mocked(activityVersionRepository.save).mockRejectedValueOnce(
      new Error("Erro ao salvar versão"),
    );

    await expect(service.execute(input)).rejects.toThrow(
      "Erro ao salvar versão",
    );

    expect(activityVersionRepository.save).toHaveBeenCalledOnce();
  });
});