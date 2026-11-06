import { beforeEach, describe, expect, it, vi } from "vitest";

const { getRepositoryMock } = vi.hoisted(() => ({
  getRepositoryMock: vi.fn(),
}));

vi.mock("../../../src/shared/database/data-source", () => ({
  AppDataSource: {
    getRepository: getRepositoryMock,
  },
}));

import { ActivityRepository } from "../../../src/modules/activities/repositories/implementations/ActivityRepository";
import { Activity } from "../../../src/modules/activities/entities/Activity";
import { ActivityFavorite } from "../../../src/modules/activities/entities/ActivityFavorite";
import { ActivityStatus } from "../../../src/modules/activities/types/ActivityStatus";
import { ActivityVersionStatus } from "../../../src/modules/activities/types/ActivityVersionStatus";
import { ActivityVisibility } from "../../../src/modules/activities/types/ActivityVisibility";

describe("ActivityRepository - catálogo e favoritos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve restringir o catálogo público a atividades publicadas e visíveis publicamente", async () => {
    const queryBuilder = {
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      distinct: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      addOrderBy: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
    };
    getRepositoryMock.mockReturnValue({
      createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
    });

    const repository = new ActivityRepository();
    await repository.list({
      page: 1,
      limit: 12,
      scope: "public",
    });

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      "activity.status = :publicPublishedStatus",
      { publicPublishedStatus: ActivityStatus.PUBLISHED },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      "activity.visibility = :publicVisibility",
      { publicVisibility: ActivityVisibility.PUBLIC },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      "activity.current_published_version_id IS NOT NULL",
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining("public_version.status = :publicVersionStatus"),
      { publicVersionStatus: ActivityVersionStatus.PUBLISHED },
    );
  });

  it("deve restringir a consulta às atividades favorited pelo usuário", async () => {
    const queryBuilder = {
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      distinct: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      addOrderBy: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
    };
    getRepositoryMock.mockReturnValue({
      createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
    });

    const repository = new ActivityRepository();
    await repository.list({
      page: 1,
      limit: 9,
      teacherId: "teacher-123",
      scope: "explore",
      favoriteIds: ["activity-1", "activity-2"],
      favoritesOnly: true,
    });

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      "activity.id IN (:...favoriteIds)",
      { favoriteIds: ["activity-1", "activity-2"] },
    );
  });

  it("deve retornar lista vazia sem consultar IDs quando não houver favoritos", async () => {
    const queryBuilder = {
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      distinct: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      addOrderBy: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
    };
    getRepositoryMock.mockReturnValue({
      createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
    });

    const repository = new ActivityRepository();
    await repository.list({
      page: 1,
      limit: 9,
      teacherId: "teacher-123",
      scope: "mine",
      favoriteIds: [],
      favoritesOnly: true,
    });

    expect(queryBuilder.andWhere).toHaveBeenCalledWith("1 = 0");
  });

  it("deve listar os IDs de atividades favoritas do usuário", async () => {
    getRepositoryMock
      .mockReturnValueOnce({})
      .mockReturnValueOnce({
        find: vi.fn().mockResolvedValue([
          { activityId: "activity-1" },
          { activityId: "activity-2" },
        ]),
      });

    const repository = new ActivityRepository();
    const result = await repository.listFavoriteIds("teacher-123");

    expect(getRepositoryMock).toHaveBeenNthCalledWith(1, Activity);
    expect(getRepositoryMock).toHaveBeenNthCalledWith(2, ActivityFavorite);
    expect(result).toEqual(["activity-1", "activity-2"]);
  });
});
