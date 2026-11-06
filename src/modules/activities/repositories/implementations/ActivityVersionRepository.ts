import type { EntityManager } from "typeorm";
import { AppDataSource } from "../../../../shared/database/data-source";
import { ActivityVersion } from "../../entities/ActivityVersion";
import { ActivityVersionStatus } from "../../types/ActivityVersionStatus";
import { IActivityVersionRepository } from "../interfaces/IActivityVersionRepository";

export class ActivityVersionRepository
  implements IActivityVersionRepository
{
  private readonly repository = AppDataSource.getRepository(ActivityVersion);

  async findById(id: string): Promise<ActivityVersion | null> {
    return this.repository.findOne({
      where: { id },
    });
  }

  async hasAudioStorageKeyReference(
    storageKey: string,
    excludingVersionId: string,
  ): Promise<boolean> {
    const rows = await AppDataSource.query<Array<{ is_referenced: boolean }>>(
      `SELECT EXISTS (
        SELECT 1
        FROM public.activity_versions version
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE WHEN jsonb_typeof(version.content->'passages') = 'array'
            THEN version.content->'passages' ELSE '[]'::jsonb END
        ) AS passage
        WHERE version.id <> $2
          AND passage->'audio'->>'storageKey' = $1
      ) AS is_referenced`,
      [storageKey, excludingVersionId],
    );
    return rows[0]?.is_referenced ?? false;
  }

  async findByIdAndActivityIdForUpdate(
    manager: EntityManager,
    id: string,
    activityId: string,
  ): Promise<ActivityVersion | null> {
    return manager.getRepository(ActivityVersion).findOne({
      where: { id, activityId },
      lock: { mode: "pessimistic_write" },
    });
  }

  async findByActivityIdAndVersionNumber(
    activityId: string,
    versionNumber: number,
  ): Promise<ActivityVersion | null> {
    return this.repository.findOne({
      where: {
        activityId,
        versionNumber,
      },
    });
  }

  async findByActivityId(
    activityId: string,
  ): Promise<ActivityVersion[]> {
    return this.repository.find({
      where: { activityId },
      order: { versionNumber: "DESC" },
    });
  }

  async findByActivityIdAndStatus(
    activityId: string,
    status: ActivityVersionStatus,
  ): Promise<ActivityVersion | null> {
    return this.repository.findOne({
      where: {
        activityId,
        status,
      },
    });
  }

  async findLatestByActivityId(
    activityId: string,
  ): Promise<ActivityVersion | null> {
    return this.repository.findOne({
      where: { activityId },
      order: { versionNumber: "DESC" },
    });
  }

  async save(
    manager: EntityManager,
    version: ActivityVersion,
  ): Promise<ActivityVersion> {
    return manager.getRepository(ActivityVersion).save(version);
  }
}