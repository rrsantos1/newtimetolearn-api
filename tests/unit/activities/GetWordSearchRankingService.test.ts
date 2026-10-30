import { beforeEach, describe, expect, it, vi } from "vitest";

import { Activity } from "../../../src/modules/activities/entities/Activity";
import { ActivityAttempt } from "../../../src/modules/activities/entities/ActivityAttempt";
import type { IActivityRepository } from "../../../src/modules/activities/repositories/interfaces/IActivityRepository";
import type { IActivityAttemptRepository } from "../../../src/modules/activities/repositories/interfaces/IActivityAttemptRepository";
import { GetWordSearchRankingService } from "../../../src/modules/activities/services/GetWordSearchRankingService";
import { ActivityStatus } from "../../../src/modules/activities/types/ActivityStatus";
import { ActivityType } from "../../../src/modules/activities/types/ActivityType";

describe("GetWordSearchRankingService", () => {
  let service: GetWordSearchRankingService;
  let activityRepository: IActivityRepository;
  let attemptRepository: IActivityAttemptRepository;
  let activity: Activity;

  const slug = "animais-brasileiros";

  beforeEach(() => {
    vi.clearAllMocks();

    activity = new Activity();
    activity.id = "activity-123";
    activity.slug = slug;
    activity.type = ActivityType.WORD_SEARCH;
    activity.status = ActivityStatus.PUBLISHED;
    activity.deletedAt = null;

    activityRepository = {
      findById: vi.fn(),
      findBySlug: vi.fn(),
      findBySlugWithVersions: vi.fn().mockResolvedValue(activity),
      findByIdAndTeacherId: vi.fn(),
      findBySlugAndTeacherId: vi.fn(),
      list: vi.fn(),
      save: vi.fn(),
      updatePublishedVersion: vi.fn(),
    };

    attemptRepository = {
      create: vi.fn(),
      getRanking: vi.fn().mockResolvedValue([]),
      listByActivity: vi.fn(),
    };

    service = new GetWordSearchRankingService(
      activityRepository,
      attemptRepository,
    );
  });

  it("deve retornar o ranking da atividade com posições sequenciais", async () => {
    const first = new ActivityAttempt();
    first.studentName = "Ana";
    first.score = 100;
    first.elapsedSeconds = 42;
    first.createdAt = new Date("2026-10-29T10:00:00.000Z");

    const second = new ActivityAttempt();
    second.studentName = "Bruno";
    second.score = 85;
    second.elapsedSeconds = 65;
    second.createdAt = new Date("2026-10-29T11:00:00.000Z");

    vi.mocked(attemptRepository.getRanking).mockResolvedValueOnce([
      first,
      second,
    ]);

    const result = await service.execute(slug);

    expect(activityRepository.findBySlugWithVersions).toHaveBeenCalledWith(slug);
    expect(attemptRepository.getRanking).toHaveBeenCalledWith(activity.id);
    expect(result).toEqual([
      {
        position: 1,
        studentName: "Ana",
        score: 100,
        elapsedSeconds: 42,
        createdAt: first.createdAt,
      },
      {
        position: 2,
        studentName: "Bruno",
        score: 85,
        elapsedSeconds: 65,
        createdAt: second.createdAt,
      },
    ]);
  });

  it("deve retornar uma lista vazia quando não houver tentativas", async () => {
    await expect(service.execute(slug)).resolves.toEqual([]);
    expect(attemptRepository.getRanking).toHaveBeenCalledWith(activity.id);
  });

  it("deve lançar ACTIVITY_NOT_FOUND quando a atividade não existir", async () => {
    vi.mocked(activityRepository.findBySlugWithVersions).mockResolvedValueOnce(null);

    await expect(service.execute(slug)).rejects.toMatchObject({
      code: "ACTIVITY_NOT_FOUND",
      statusCode: 404,
    });
    expect(attemptRepository.getRanking).not.toHaveBeenCalled();
  });

  it("deve rejeitar uma atividade que não seja caça-palavras", async () => {
    activity.type = ActivityType.QUIZ;

    await expect(service.execute(slug)).rejects.toMatchObject({
      code: "ACTIVITY_NOT_FOUND",
      statusCode: 404,
    });
    expect(attemptRepository.getRanking).not.toHaveBeenCalled();
  });

  it("deve rejeitar uma atividade que não esteja publicada", async () => {
    activity.status = ActivityStatus.DRAFT;

    await expect(service.execute(slug)).rejects.toMatchObject({
      code: "ACTIVITY_NOT_FOUND",
      statusCode: 404,
    });
    expect(attemptRepository.getRanking).not.toHaveBeenCalled();
  });

  it("deve propagar erros ao consultar as tentativas", async () => {
    vi.mocked(attemptRepository.getRanking).mockRejectedValueOnce(
      new Error("Falha ao consultar tentativas"),
    );

    await expect(service.execute(slug)).rejects.toThrow(
      "Falha ao consultar tentativas",
    );
  });
});
