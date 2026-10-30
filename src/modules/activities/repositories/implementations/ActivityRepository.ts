import type { EntityManager } from "typeorm";
import { AppDataSource } from "../../../../shared/database/data-source";
import { Activity } from "../../entities/Activity";
import { IActivityRepository, ListActivitiesFilters, ListActivitiesResult } from "../interfaces/IActivityRepository";
import { ActivityStatus } from "../../types/ActivityStatus";
import { ActivityVersionStatus } from "../../types/ActivityVersionStatus";

export class ActivityRepository implements IActivityRepository {
  private readonly repository = AppDataSource.getRepository(Activity);

  async findById(id: string): Promise<Activity | null> {
    return this.repository.findOne({
      where: { id },
    });
  }

  async findBySlug(slug: string): Promise<Activity | null> {
    return this.repository.findOne({
      where: { slug },
    });
  }

  async findBySlugWithVersions(
    slug: string,
  ): Promise<Activity | null> {
    return this.repository
      .createQueryBuilder("activity")
      .leftJoinAndSelect("activity.versions", "version")
      .where("activity.slug = :slug", { slug })
      .andWhere("activity.deleted_at IS NULL")
      .orderBy("version.version_number", "DESC")
      .getOne();
  }

  async findByIdAndTeacherId(
    id: string,
    teacherId: string,
  ): Promise<Activity | null> {
    return this.repository.findOne({
      where: {
        id,
        teacherId,
      },
    });
  }

  async findBySlugAndTeacherId(
    slug: string,
    teacherId: string,
  ): Promise<Activity | null> {
    return this.repository.findOne({
      where: {
        slug,
        teacherId,
      },
    });
  }

  async save(
    manager: EntityManager,
    activity: Activity,
  ): Promise<Activity> {
    return manager.getRepository(Activity).save(activity);
  }

  async updatePublishedVersion(
    manager: EntityManager,
    activityId: string,
    versionId: string,
  ): Promise<void> {
    await manager.getRepository(Activity).update(activityId, {
      status: ActivityStatus.PUBLISHED,
      currentPublishedVersionId: versionId,
    });
  }

  async list(
    filters: ListActivitiesFilters,
  ): Promise<ListActivitiesResult> {
    const { page, limit, teacherId, includeAll } = filters;

    const query = this.repository
      .createQueryBuilder("activity")
      .leftJoinAndSelect("activity.versions", "version")
      .where("activity.deleted_at IS NULL");

    if (!includeAll) {
      if (!teacherId) {
        throw new Error(
          "O identificador do professor é obrigatório para listar atividades.",
        );
      }

      query.andWhere(
        `(
          activity.teacher_id = :teacherId
          OR (
            activity.status = :publishedStatus
            AND activity.current_published_version_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM activity_versions published_version
              WHERE published_version.id =
                activity.current_published_version_id
                AND published_version.activity_id = activity.id
                AND published_version.status = :versionPublishedStatus
            )
          )
        )`,
        {
          teacherId,
          publishedStatus: ActivityStatus.PUBLISHED,
          versionPublishedStatus: ActivityVersionStatus.PUBLISHED,
        },
      );
    }

    const [items, total] = await query
      .orderBy("activity.created_at", "DESC")
      .addOrderBy("version.version_number", "DESC")
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items,
      total,
    };
  }
}
