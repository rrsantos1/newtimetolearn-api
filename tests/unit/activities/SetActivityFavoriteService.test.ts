import type { EntityManager } from "typeorm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Activity } from "../../../src/modules/activities/entities/Activity";
import { SetActivityFavoriteService } from "../../../src/modules/activities/services/SetActivityFavoriteService";
import type { IActivityRepository } from "../../../src/modules/activities/repositories/interfaces/IActivityRepository";
import type { IActivityFavoriteRepository } from "../../../src/modules/activities/repositories/interfaces/IActivityFavoriteRepository";

describe("SetActivityFavoriteService", () => {
  let service: SetActivityFavoriteService;
  let manager: EntityManager;
  let activityRepository: IActivityRepository;
  let favoriteRepository: IActivityFavoriteRepository;
  let activity: Activity;

  const input = {
    userId: "teacher-123",
    slug: "animais-brasileiros",
    favorite: true,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();

    manager = {} as EntityManager;
    activity = new Activity();
    activity.id = "activity-123";
    activity.slug = input.slug;
    activity.deletedAt = null;

    activityRepository = {
      findById: vi.fn(),
      listFavoriteIds: vi.fn(),
      findBySlug: vi.fn().mockResolvedValue(activity),
      findBySlugWithVersions: vi.fn(),
      findByIdAndTeacherId: vi.fn(),
      findBySlugAndTeacherId: vi.fn(),
      list: vi.fn(),
      save: vi.fn(),
      updatePublishedVersion: vi.fn(),
    };

    favoriteRepository = {
      isFavorite: vi.fn(),
      listActivityIdsByUser: vi.fn(),
      add: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    };

    service = new SetActivityFavoriteService(
      manager,
      activityRepository,
      favoriteRepository,
    );
  });

  it("deve adicionar a atividade aos favoritos", async () => {
    const result = await service.execute(input);

    expect(result).toEqual({ isFavorite: true });
    expect(favoriteRepository.add).toHaveBeenCalledOnce();
    expect(favoriteRepository.add).toHaveBeenCalledWith(
      manager,
      input.userId,
      activity.id,
    );
    expect(favoriteRepository.remove).not.toHaveBeenCalled();
  });

  it("deve remover a atividade dos favoritos", async () => {
    const result = await service.execute({ ...input, favorite: false });

    expect(result).toEqual({ isFavorite: false });
    expect(favoriteRepository.remove).toHaveBeenCalledOnce();
    expect(favoriteRepository.remove).toHaveBeenCalledWith(
      input.userId,
      activity.id,
    );
    expect(favoriteRepository.add).not.toHaveBeenCalled();
  });

  it("deve rejeitar uma atividade inexistente", async () => {
    vi.mocked(activityRepository.findBySlug).mockResolvedValueOnce(null);

    await expect(service.execute(input)).rejects.toMatchObject({
      code: "ACTIVITY_NOT_FOUND",
      statusCode: 404,
    });

    expect(favoriteRepository.add).not.toHaveBeenCalled();
    expect(favoriteRepository.remove).not.toHaveBeenCalled();
  });

  it("deve rejeitar uma atividade excluída", async () => {
    activity.deletedAt = new Date();

    await expect(service.execute(input)).rejects.toMatchObject({
      code: "ACTIVITY_NOT_FOUND",
      statusCode: 404,
    });

    expect(favoriteRepository.add).not.toHaveBeenCalled();
  });

  it("deve propagar falhas do repositório de favoritos", async () => {
    vi.mocked(favoriteRepository.add).mockRejectedValueOnce(
      new Error("Falha ao salvar favorito"),
    );

    await expect(service.execute(input)).rejects.toThrow(
      "Falha ao salvar favorito",
    );
  });
});
