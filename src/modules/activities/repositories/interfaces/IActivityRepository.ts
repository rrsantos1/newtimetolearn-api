import type { EntityManager } from "typeorm";
import type { Activity } from "../../entities/Activity";

export interface ListActivitiesFilters {
  page: number;
  limit: number;
  teacherId?: string;
  scope: "mine" | "explore" | "all";
  search?: string;
  type?: Activity["type"];
  difficulty?: "EASY" | "MEDIUM" | "HARD";
}

export interface ListActivitiesResult {
  items: Activity[];
  total: number;
}

export interface IActivityRepository {
  findById(id: string): Promise<Activity | null>;

  findBySlug(slug: string): Promise<Activity | null>;

  findBySlugWithVersions(slug: string): Promise<Activity | null>;

  findByIdAndTeacherId(
    id: string,
    teacherId: string,
  ): Promise<Activity | null>;

  findBySlugAndTeacherId(
    slug: string,
    teacherId: string,
  ): Promise<Activity | null>;

  list(
    filters: ListActivitiesFilters,
  ): Promise<ListActivitiesResult>;

  save(
    manager: EntityManager,
    activity: Activity,
  ): Promise<Activity>;

  updatePublishedVersion(
    manager: EntityManager,
    activityId: string,
    versionId: string,
  ): Promise<void>;
}
