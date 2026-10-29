import type { EntityManager } from "typeorm";
import type { Activity } from "../../entities/Activity";

export interface ListActivitiesFilters {
  page: number;
  limit: number;
  teacherId?: string;
  includeAll: boolean;
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
}