import type { EntityManager } from "typeorm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Activity } from "../../../src/modules/activities/entities/Activity";
import { DeleteActivityService } from "../../../src/modules/activities/services/DeleteActivityService";
import { ActivityStatus } from "../../../src/modules/activities/types/ActivityStatus";
import type { IActivityRepository } from "../../../src/modules/activities/repositories/interfaces/IActivityRepository";

describe("DeleteActivityService", () => {
  let service: DeleteActivityService;
  let activityRepository: IActivityRepository;
  let manager: EntityManager;
  let activity: Activity;

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

    activityRepository = {
      findById: vi.fn(),
      findBySlug: vi.fn().mockImplementation(
        async () => activity,
      ),
      findBySlugWithVersions: vi.fn(),
      findByIdAndTeacherId: vi.fn(),
      findBySlugAndTeacherId: vi.fn(),
      list: vi.fn(),
      save: vi.fn().mockImplementation(
        async (
          _manager: EntityManager,
          savedActivity: Activity,
        ) => savedActivity,
      ),
      updatePublishedVersion: vi.fn().mockResolvedValue(undefined),
    };

    service = new DeleteActivityService(
      manager,
      activityRepository,
    );
  });

  it("deve excluir logicamente uma atividade", async () => {
    const result = await service.execute(input);

    expect(result.id).toBe(activity.id);
    expect(result.slug).toBe(activity.slug);

    expect(result.deletedAt).toBeInstanceOf(Date);
    expect(activity.deletedAt).toBe(result.deletedAt);

    expect(activityRepository.findBySlug).toHaveBeenCalledWith(
      input.slug,
    );

    expect(activityRepository.save).toHaveBeenCalledOnce();
    expect(activityRepository.save).toHaveBeenCalledWith(
      manager,
      activity,
    );
  });

  it("deve preservar o status da atividade após a exclusão", async () => {
    activity.status = ActivityStatus.PUBLISHED;
    activity.currentPublishedVersionId = "published-version-123";

    const originalStatus = activity.status;
    const originalPublishedVersionId =
      activity.currentPublishedVersionId;

    await service.execute(input);

    expect(activity.status).toBe(originalStatus);

    expect(activity.currentPublishedVersionId).toBe(
      originalPublishedVersionId,
    );

    expect(activity.deletedAt).toBeInstanceOf(Date);
  });

  it("deve permitir excluir uma atividade em rascunho", async () => {
    activity.status = ActivityStatus.DRAFT;

    const result = await service.execute(input);

    expect(result.deletedAt).toBeInstanceOf(Date);
    expect(activityRepository.save).toHaveBeenCalledOnce();
  });

  it("deve lançar erro quando a atividade não existir", async () => {
    vi.mocked(
      activityRepository.findBySlug,
    ).mockResolvedValueOnce(null);

    await expect(service.execute(input)).rejects.toMatchObject({
      code: "ACTIVITY_NOT_FOUND",
      statusCode: 404,
    });

    expect(activityRepository.save).not.toHaveBeenCalled();
  });

  it("deve impedir a exclusão de uma atividade já excluída", async () => {
    activity.deletedAt = new Date();

    await expect(service.execute(input)).rejects.toMatchObject({
      code: "ACTIVITY_NOT_FOUND",
      statusCode: 404,
    });

    expect(activityRepository.save).not.toHaveBeenCalled();
  });

  it("deve impedir que um professor exclua a atividade de outro professor", async () => {
    activity.teacherId = "another-teacher";

    await expect(service.execute(input)).rejects.toMatchObject({
      code: "ACTIVITY_NOT_FOUND",
      statusCode: 404,
    });

    expect(activityRepository.save).not.toHaveBeenCalled();
  });

  it("deve propagar o erro caso não consiga salvar a atividade", async () => {
    vi.mocked(
      activityRepository.save,
    ).mockRejectedValueOnce(
      new Error("Erro ao salvar atividade"),
    );

    await expect(service.execute(input)).rejects.toThrow(
      "Erro ao salvar atividade",
    );

    expect(activityRepository.save).toHaveBeenCalledOnce();
  });
});